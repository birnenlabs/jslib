/**
 * Type checked function that combines 2 promises using the function provided.
 *
 * @template P1
 * @template P2
 * @template R
 *
 * @param {P1|Promise<P1>} promise1
 * @param {P2|Promise<P2>} promise2
 * @param {function(P1, P2): R|Promise<R>} combineFn
 * @return {Promise<R>}
 */
export function combine2(promise1, promise2, combineFn) {
  return Promise.all([promise1, promise2]).then((values) => combineFn(values[0], values[1]));
}

/**
 * Type checked function that combines 3 promises using the function provided.
 *
 * @template P1
 * @template P2
 * @template P3
 * @template R
 *
 * @param {P1|Promise<P1>} promise1
 * @param {P2|Promise<P2>} promise2
 * @param {P3|Promise<P3>} promise3
 * @param {function(P1, P2, P3): R|Promise<R>} combineFn
 * @return {Promise<R>}
 */
export function combine3(promise1, promise2, promise3, combineFn) {
  return Promise.all([promise1, promise2, promise3]).then((values) => combineFn(values[0], values[1], values[2]));
}

/**
 * Type checked function that combines 4 promises using the function provided.
 *
 * @template P1
 * @template P2
 * @template P3
 * @template P4
 * @template R
 *
 * @param {P1|Promise<P1>} promise1
 * @param {P2|Promise<P2>} promise2
 * @param {P3|Promise<P3>} promise3
 * @param {P4|Promise<P4>} promise4
 * @param {function(P1, P2, P3, P4): R|Promise<R>} combineFn
 * @return {Promise<R>}
 */
export function combine4(promise1, promise2, promise3, promise4, combineFn) {
  return Promise.all([promise1, promise2, promise3, promise4]).then((values) => combineFn(values[0], values[1], values[2], values[3]));
}

/**
 * @template R
 *
 * @param {number} delay
 * @param {R} result
 * @return {Promise<R>}
 */
export function promiseTimeout(delay, result) {
  return new Promise((resolve) => setTimeout(resolve, delay)).then(() => result);
}

/**
 * @template R
 *
 * @param {string} log
 * @param {R} result
 * @return {R}
 */
export function promiseLog(log, result) {
  console.log(log);
  return result;
}
