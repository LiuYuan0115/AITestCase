export function defineUnlistedScript(arg) {
  if (arg == null || typeof arg === "function") return { main: arg };
  return arg;
}
