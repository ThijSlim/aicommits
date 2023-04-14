import fs from "fs/promises";
import path from "path";
import { describe, it, expect } from "vitest";
import { createFixture } from "../utils.js";

describe("config", async () => {
  const openAiToken = "OPENAI_KEY=sk-abc";

  it.concurrent("set unknown config file", async () => {
    const { gitai } = await createFixture();

    const { stderr } = await gitai(["config", "set", "UNKNOWN=1"], {
      reject: false,
    });

    expect(stderr).toMatch("Invalid config property: UNKNOWN");
  });

  it.concurrent("set invalid OPENAI_KEY", async () => {
    const { gitai } = await createFixture();

    const { stderr } = await gitai(["config", "set", "OPENAI_KEY=abc"], {
      reject: false,
    });

    expect(stderr).toMatch(
      'Invalid config property OPENAI_KEY: Must start with "sk-"'
    );
  });

  it.concurrent("set config file", async () => {
    const { fixture, gitai } = await createFixture();
    const configPath = path.join(fixture.path, ".gitai");

    await gitai(["config", "set", openAiToken]);

    const configFile = await fs.readFile(configPath, "utf8");
    expect(configFile).toMatch(openAiToken);
  });

  it.concurrent("get config file", async () => {
    const { gitai } = await createFixture();

    await gitai(["config", "set", openAiToken]);
    const { stdout } = await gitai(["config", "get", "OPENAI_KEY"]);

    expect(stdout).toBe(openAiToken);
  });

  it.concurrent("reading unknown config", async () => {
    const { fixture, gitai } = await createFixture();
    const configPath = path.join(fixture.path, ".gitai");

    await gitai(["config", "set", openAiToken]);

    await fs.appendFile(configPath, "UNKNOWN=1");

    const { stdout, stderr } = await gitai(["config", "get", "UNKNOWN"], {
      reject: false,
    });

    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  it.concurrent("setting invalid timeout config", async () => {
    const { gitai } = await createFixture();

    const { stderr } = await gitai(["config", "set", "timeout=abc"], {
      reject: false,
    });

    expect(stderr).toMatch("Must be an integer");
  });

  it.concurrent("setting valid timeout config", async () => {
    const { fixture, gitai } = await createFixture();
    const configPath = path.join(fixture.path, ".gitai");

    const timeout = "timeout=20000";
    await gitai(["config", "set", timeout]);

    const configFile = await fs.readFile(configPath, "utf8");

    expect(configFile).toMatch(timeout);
  });
});
