export function createEnvironment(getGlobals) {
  const setup = () => {
    const envGlobals = getGlobals();
    const ogGlobals = getOgGlobals(envGlobals);
    applyGlobals(envGlobals);
    return () => {
      applyGlobals(ogGlobals);
    };
  };
  const run = async (fn) => {
    const teardown = setup();
    try {
      return await fn();
    } finally {
      teardown();
    }
  };
  return {
    setup,
    run
  };
}
export function getOgGlobals(envGlobals) {
  return Object.keys(envGlobals).reduce((acc, key) => {
    acc[key] = globalThis[key];
    return acc;
  }, {});
}
export function applyGlobals(globals) {
  Object.entries(globals).forEach(([key, envValue]) => {
    try {
      globalThis[key] = envValue;
    } catch {
    }
  });
}
