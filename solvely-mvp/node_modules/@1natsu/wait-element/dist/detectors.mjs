const isExist = (element) => {
  return element !== null ? { isDetected: true, result: element } : { isDetected: false };
};
const isNotExist = (element) => {
  return element === null ? { isDetected: true, result: null } : { isDetected: false };
};

export { isExist, isNotExist };
