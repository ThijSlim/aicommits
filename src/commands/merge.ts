import fs from "fs/promises";
import { command } from "cleye";
import { bgCyan, black, red } from "kolorist";
import { intro, spinner } from "@clack/prompts";
import { execa } from "execa";
import { KnownError, handleCliError } from "../utils/error.js";
import { assertGitRepo, getUnresolvedMergeFiles } from "../utils/git.js";
import { autoMergeFile } from "../utils/openai-merge.js";
import { getConfig } from "../utils/config.js";

export default command(
  {
    name: "merge",
    parameters: ["<branch>"],
  },
  (argv) => {
    (async () => {
      const { branch } = argv._;
      const detectingFiles = spinner();

      intro(bgCyan(black(" aigit ")));
      await assertGitRepo();

      detectingFiles.start("Merging files ...");

      try {
        await execa("git", ["merge", branch]);
      } catch {
        /* empty */
      }

      const unresolvedFiles = await getUnresolvedMergeFiles();
      if (unresolvedFiles) {
        detectingFiles.stop(
          `$Unresolved files:\n${unresolvedFiles
            .map((file) => `     ${file}`)
            .join("\n")}`
        );
      } else {
        detectingFiles.stop("No unresolved files found.");
      }

      const { env } = process;

      const config = await getConfig({
        OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
        proxy:
          env.https_proxy ||
          env.HTTPS_PROXY ||
          env.http_proxy ||
          env.HTTP_PROXY,
      });

      const s = spinner();

      for (const file of unresolvedFiles) {
        const fileContent = await fs.readFile(file, "utf8");
        s.start(`Merging files in ${file}`);
        try {
          const content = await autoMergeFile(
            config.OPENAI_KEY,
            config.model,
            fileContent,
            config.proxy
          );

          s.stop(`Merged content${content}`);
        } finally {
          s.stop("Changes analyzed");
        }
      }

      await execa("git", ["reset", "--hard"]);

      throw new KnownError(`Invalid branch: ${branch}`);
    })().catch((error) => {
      console.error(`${red("✖")} ${error.message}`);
      handleCliError(error);
      process.exit(1);
    });
  }
);
