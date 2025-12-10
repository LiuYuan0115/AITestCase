const safeStringifyJson = (obj, failedBack = '{}') => {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return failedBack;
  }
};

module.exports = {
  safeStringifyJson,
};
