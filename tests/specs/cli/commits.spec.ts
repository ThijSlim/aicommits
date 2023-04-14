import { describe, it, expect } from "vitest";
import {
  assertOpenAiToken,
  createFixture,
  createGit,
  files,
} from "../../utils.js";

if (process.platform === "win32") {
  // https://github.com/nodejs/node/issues/31409
  console.warn(
    "Skipping tests on Windows because Node.js spawn cant open TTYs"
  );
}

assertOpenAiToken();

describe("CLI", async () => {
  it.concurrent("Excludes files", async () => {
    const { fixture, gitai } = await createFixture(files);
    const git = await createGit(fixture.path);

    await git("add", ["data.json"]);
    const statusBefore = await git("status", [
      "--porcelain",
      "--untracked-files=no",
    ]);
    expect(statusBefore.stdout).toBe("A  data.json");

    const { stdout, exitCode } = await gitai(
      ["commit", "--exclude", "data.json"],
      {
        reject: false,
      }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toMatch("No staged changes found.");
    await fixture.rm();
  });

  it.concurrent("Generates commit message", async () => {
    const { fixture, gitai } = await createFixture(files);
    const git = await createGit(fixture.path);

    await git("add", ["data.json"]);

    const committing = gitai(["commit"]);
    committing.stdout?.on("data", (buffer: Buffer) => {
      const stdout = buffer.toString();
      if (stdout.match("└")) {
        committing.stdin?.write("y");
        committing.stdin?.end();
      }
    });

    await committing;

    const statusAfter = await git("status", [
      "--porcelain",
      "--untracked-files=no",
    ]);
    expect(statusAfter.stdout).toBe("");

    await fixture.rm();
  });

  it.concurrent(
    "Accepts --all flag, staging all changes before commit",
    async () => {
      const { fixture, gitai } = await createFixture(files);
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);
      await git("commit", ["-m", "wip"]);

      await fixture.writeFile("data.json", "Test");

      const statusBefore = await git("status", [
        "--short",
        "--untracked-files=no",
      ]);
      expect(statusBefore.stdout).toBe(" M data.json");

      const committing = gitai(["commit", "--all"]);
      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--short",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      await fixture.rm();
    }
  );

  it.concurrent("Accepts --generate flag, overriding config", async () => {
    const { fixture, gitai } = await createFixture({
      ...files,
      ".gitai": `${files[".gitai"]}\ngenerate=4`,
    });
    const git = await createGit(fixture.path);

    await git("add", ["data.json"]);

    // Generate flag should override generate config
    const committing = gitai(["commit", "--generate", "2"]);

    // Hit enter to accept the commit message
    committing.stdout?.on("data", function onPrompt(buffer: Buffer) {
      const stdout = buffer.toString();
      if (stdout.match("└")) {
        committing.stdin?.write("\r");
        committing.stdin?.end();
        committing.stdout?.off("data", onPrompt);
      }
    });

    const { stdout } = await committing;
    const countChoices = stdout.match(/ {2}[●○]/g)?.length ?? 0;

    expect(countChoices).toBe(2);

    const statusAfter = await git("status", [
      "--porcelain",
      "--untracked-files=no",
    ]);
    expect(statusAfter.stdout).toBe("");

    await fixture.rm();
  });

  it.concurrent(
    "Generates Japanese commit message via locale config",
    async () => {
      // https://stackoverflow.com/a/15034560/911407
      const japanesePattern =
        /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFF9F\u4E00-\u9FAF\u3400-\u4DBF]/;

      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\nlocale=ja`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit"]);

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      const { stdout: commitMessage } = await git("log", ["--oneline"]);
      expect(commitMessage).toMatch(japanesePattern);

      await fixture.rm();
    }
  );

  describe("commit types", () => {
    it.concurrent("Conventional commits", async () => {
      const conventionalCommitPattern =
        /(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\ntype=conventional`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit"]);

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      const { stdout: commitMessage } = await git("log", ["--oneline"]);
      expect(commitMessage).toMatch(conventionalCommitPattern);

      await fixture.rm();
    });

    it.concurrent("Accepts --type flag, overriding config", async () => {
      const conventionalCommitPattern =
        /(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\ntype=other`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      // Generate flag should override generate config
      const committing = gitai(["commit", "--type", "conventional"]);

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      const { stdout: commitMessage } = await git("log", ["--oneline"]);
      expect(commitMessage).toMatch(conventionalCommitPattern);

      await fixture.rm();
    });

    it.concurrent("Accepts empty --type flag", async () => {
      const conventionalCommitPattern =
        /(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test):\s/;
      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\ntype=conventional`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit", "--type", ""]);

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      const { stdout: commitMessage } = await git("log", ["--oneline"]);
      expect(commitMessage).not.toMatch(conventionalCommitPattern);

      await fixture.rm();
    });
  });

  describe("proxy", () => {
    it.concurrent("Fails on invalid proxy", async () => {
      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\nproxy=http://localhost:1234`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit"], {
        reject: false,
      });

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      const { stdout, exitCode } = await committing;

      expect(exitCode).toBe(1);
      expect(stdout).toMatch("connect ECONNREFUSED");

      await fixture.rm();
    });

    it.concurrent("Connects with config", async () => {
      const { fixture, gitai } = await createFixture({
        ...files,
        ".gitai": `${files[".gitai"]}\nproxy=http://localhost:8888`,
      });
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit"]);

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      await fixture.rm();
    });

    it.concurrent("Connects with env variable", async () => {
      const { fixture, gitai } = await createFixture(files);
      const git = await createGit(fixture.path);

      await git("add", ["data.json"]);

      const committing = gitai(["commit"], {
        env: {
          HTTP_PROXY: "http://localhost:8888",
        },
      });

      committing.stdout?.on("data", (buffer: Buffer) => {
        const stdout = buffer.toString();
        if (stdout.match("└")) {
          committing.stdin?.write("y");
          committing.stdin?.end();
        }
      });

      await committing;

      const statusAfter = await git("status", [
        "--porcelain",
        "--untracked-files=no",
      ]);
      expect(statusAfter.stdout).toBe("");

      await fixture.rm();
    });
  });
});
