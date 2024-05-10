/**
 * Will return true if we are running in a service worker context.
 *
 * @return {boolean}
 */
export function isServiceWorker() {
  return !self.window;
}
