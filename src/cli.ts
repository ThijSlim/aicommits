import { cli } from "cleye";
import { description, version } from "../package.json";
import gitai from "./commands/commit.js";
import prepareCommitMessageHook from "./commands/prepare-commit-msg-hook.js";
import configCommand from "./commands/config.js";
import mergeCommand from "./commands/merge.js";
import commitCommand from "./commands/commit.js";
import hookCommand, { isCalledFromGitHook } from "./commands/hook.js";
import { execa } from "execa";

const rawArgv = process.argv.slice(2);

cli(
  {
    name: "gitai",

    version,

    /**
     * Since this is a wrapper around `git commit`,
     * flags should not overlap with it
     * https://git-scm.com/docs/git-commit
     */

    commands: [configCommand, hookCommand, commitCommand, mergeCommand],

    help: {
      description,
    },

    ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
  },
  async (argv) => {
    if (isCalledFromGitHook) {
      prepareCommitMessageHook();
    } else {
      await execa("git", [...rawArgv]);
    }
  },
  rawArgv
);
