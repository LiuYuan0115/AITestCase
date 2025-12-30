export function safeStringToNumber(str) {
  const num = Number(str);
  return isNaN(num) ? null : num;
}
