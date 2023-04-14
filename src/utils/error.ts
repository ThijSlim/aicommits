import { dim } from "kolorist";
import { version } from "../../package.json";

export class KnownError extends Error {}

const indent = "    ";

export const handleCliError = (error: Error) => {
  if (!(error instanceof KnownError)) {
    if (error.stack) {
      console.error(dim(error.stack.split("\n").slice(1).join("\n")));
    }
    console.error(`\n${indent}${dim(`gitai v${version}`)}`);
    console.error(
      `\n${indent}Please open a Bug report with the information above:`
    );
    console.error(
      `${indent}https://github.com/ThijSlim/gitai/issues/new/choose`
    );
  }
};
