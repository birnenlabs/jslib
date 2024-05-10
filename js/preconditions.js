/**
 * @template T
 * @param {T|undefined|null} item
 * @param {string=} msg
 * @return {T}
 */
export function checkNonUndefined(item, msg = '') {
  if (item === undefined) {
    throw new Error(msg || 'item is undefined');
  }
  if (item === null) {
    throw new Error(msg || 'item is null');
  }
  return item;
}

/**
 * @template T
 * @param {T|undefined|null} item
 * @param {string=} msg
 * @return {T}
 */
export function checkNonEmpty(item, msg = '') {
  if (item) {
    return item;
  }
  throw new Error(msg || 'item is empty');
}
