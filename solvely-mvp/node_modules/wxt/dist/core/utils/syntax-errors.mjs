import { relative } from "node:path";
import pc from "picocolors";
import { wxt } from "../wxt.mjs";
export function isBabelSyntaxError(error) {
  return error instanceof SyntaxError && error.code === "BABEL_PARSER_SYNTAX_ERROR";
}
export function logBabelSyntaxError(error) {
  let filename = relative(wxt.config.root, error.id);
  if (filename.startsWith("..")) {
    filename = error.id;
  }
  let message = error.message.replace(
    /\(\d+:\d+\)$/,
    `(${filename}:${error.loc.line}:${error.loc.column + 1})`
  );
  if (error.frame) {
    message += "\n\n" + pc.red(error.frame);
  }
  wxt.logger.error(message);
}
