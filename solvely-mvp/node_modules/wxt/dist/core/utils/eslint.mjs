export async function getEslintVersion() {
  try {
    const require = (await import("node:module")).default.createRequire(
      import.meta.url
    );
    const { ESLint } = require("eslint");
    return ESLint.version?.split(".") ?? [];
  } catch {
    return [];
  }
}
