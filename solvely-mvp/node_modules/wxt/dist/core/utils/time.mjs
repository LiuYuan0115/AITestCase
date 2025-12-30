export function formatDuration(duration) {
  if (duration < 1e3) return `${duration} ms`;
  if (duration < 1e4) return `${(duration / 1e3).toFixed(3)} s`;
  if (duration < 6e4) return `${(duration / 1e3).toFixed(1)} s`;
  return `${(duration / 1e3).toFixed(0)} s`;
}
export function withTimeout(promise, duration) {
  return new Promise((res, rej) => {
    const timeout = setTimeout(() => {
      rej(`Promise timed out after ${duration}ms`);
    }, duration);
    promise.then(res).catch(rej).finally(() => clearTimeout(timeout));
  });
}
export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
