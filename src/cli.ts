import { cli } from "cleye";
import { description, version } from "../package.json";
import gitai from "./commands/gitai.js";
import prepareCommitMessageHook from "./commands/prepare-commit-msg-hook.js";
import configCommand from "./commands/config.js";
import mergeCommand from "./commands/merge.js";
import hookCommand, { isCalledFromGitHook } from "./commands/hook.js";

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
    flags: {
      generate: {
        type: Number,
        description:
          "Number of messages to generate (Warning: generating multiple costs more) (default: 1)",
        alias: "g",
      },
      exclude: {
        type: [String],
        description: "Files to exclude from AI analysis",
        alias: "x",
      },
      all: {
        type: Boolean,
        description:
          "Automatically stage changes in tracked files for the commit",
        alias: "a",
        default: false,
      },
      type: {
        type: String,
        description: "Type of commit message to generate",
        alias: "t",
      },
    },

    commands: [configCommand, hookCommand, mergeCommand],

    help: {
      description,
    },

    ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
  },
  (argv) => {
    if (isCalledFromGitHook) {
      prepareCommitMessageHook();
    } else {
      gitai(
        argv.flags.generate,
        argv.flags.exclude,
        argv.flags.all,
        argv.flags.type,
        rawArgv
      );
    }
  },
  rawArgv
);
