export async function isWsl() {
  const { default: isWsl2 } = await import("is-wsl");
  return isWsl2;
}
