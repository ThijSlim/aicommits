import { describe, it, expect } from "vitest";
import { createFixture, createGit } from "../../utils.js";

describe("Error cases", async () => {
  it.concurrent("Fails on non-Git project", async () => {
    const { fixture, gitai } = await createFixture();
    const { stdout, exitCode } = await gitai(["commit"], { reject: false });
    expect(exitCode).toBe(1);
    expect(stdout).toMatch("The current directory must be a Git repository!");
    await fixture.rm();
  });

  it.concurrent("Fails on no staged files", async () => {
    const { fixture, gitai } = await createFixture();
    await createGit(fixture.path);

    const { stdout, exitCode } = await gitai(["commit"], { reject: false });
    expect(exitCode).toBe(1);
    expect(stdout).toMatch(
      "No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag."
    );
    await fixture.rm();
  });
});
