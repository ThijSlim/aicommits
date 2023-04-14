import { describe, it, expect } from "vitest";
import {
  assertOpenAiToken,
  createFixture,
  createGit,
  files,
} from "../utils.js";

describe("Git hook", () => {
  assertOpenAiToken();

  it.concurrent("errors when not in Git repo", async () => {
    const { fixture, aicommits } = await createFixture(files);
    const { exitCode, stderr } = await aicommits(["hook", "install"], {
      reject: false,
    });

    expect(stderr).toMatch("The current directory must be a Git repository");
    expect(exitCode).toBe(1);

    await fixture.rm();
  });

  it.concurrent("Commits", async () => {
    const { fixture, aicommits } = await createFixture(files);
    const git = await createGit(fixture.path);

    const { stdout } = await aicommits(["hook", "install"]);
    expect(stdout).toMatch("Hook installed");

    await git("add", ["data.json"]);
    await git("commit", ["--no-edit"], {
      env: {
        HOME: fixture.path,
        USERPROFILE: fixture.path,
      },
    });

    const { stdout: commitMessage } = await git("log", ["--pretty=%B"]);
    console.log("Committed with:", commitMessage);
    expect(commitMessage.startsWith("# ")).not.toBe(true);

    await fixture.rm();
  });
});
