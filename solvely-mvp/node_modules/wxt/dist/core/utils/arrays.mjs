export function every(array, predicate) {
  for (let i = 0; i < array.length; i++)
    if (!predicate(array[i], i)) return false;
  return true;
}
export function some(array, predicate) {
  for (let i = 0; i < array.length; i++)
    if (predicate(array[i], i)) return true;
  return false;
}
export function toArray(a) {
  return Array.isArray(a) ? a : [a];
}
export function filterTruthy(array) {
  return array.filter((item) => !!item);
}
