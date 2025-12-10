/**
 * 判断是否是一个有效的时间戳
 * @param {string} value 时间戳
 * @param {number} length 时间戳长度，默认是 13 位精确到毫秒
 * @return {boolean} 是否是一个有效的时间戳
 */
const isValidTimestamp = (value, length = 13) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return false;
  }
  const num = Number(value);
  if (isNaN(new Date(num).getTime()) || String(num).length !== length) {
    return false;
  }
  return true;
};

/**
 * 获取时间差，注意返回的是字符串，且不含单位
 * @param {Number} startTime 开始时间戳
 * @param {Object} options 选项
 * @param {Number} [options.endTime=0] 结束时间戳, 默认当前时间
 * @param {String} [options.format='s'] 格式，s 表示秒，ms 表示毫秒，0.1s 表示 0.1 秒
 * @param {Number} [options.round=2] 保留小数位数
 * @return {String | number} 时间差字符串或数字 格式化后的
 */
const getTimeDiff = (startTime, { endTime = 0, format = 'ms', round = 2 } = {}) => {
  if (!startTime && typeof startTime !== 'number') {
    throw new Error('startTime is required and must be a number');
  }
  const diff = (endTime || Date.now()) - startTime;
  if (format === 'ms') {
    return diff;
  }
  if (format === 's') {
    return (diff / 1000).toFixed(round);
  }
  if (format === '0.1s') {
    return (diff / 100).toFixed(round);
  }
  return diff.toFixed(round);
};

/**
 * Curry 化 getTimeDiff
 * @param {*} startTime
 * @param {Object} options 选项, 全局选项，会和传入的 _options 合并
 * @return {Function} 返回一个函数，函数参数为 _options，返回时间差字符串或数字 格式化后的
 */
const getTimeDiffCurry = (startTime, options = {}) => {
  return (_options = {}) => {
    return getTimeDiff(startTime, { ...(options || {}), ...(_options || {}) });
  };
};

module.exports = {
  isValidTimestamp,
  getTimeDiff,
  getTimeDiffCurry,
};
