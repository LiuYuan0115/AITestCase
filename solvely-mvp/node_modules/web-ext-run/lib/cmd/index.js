// This module exports entry points for all supported commands. For performance
// reasons (faster start-up), the implementations are not statically imported
// at the top of the file, but lazily loaded in the (exported) functions.
// The latter would slow down start-up by several seconds, as seen in #1302 .

async function run(params, options) {
  const {
    default: runCommand
  } = await import('./run.js');
  return runCommand(params, options);
}
export default {
  run
};
//# sourceMappingURL=index.js.map