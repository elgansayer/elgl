/**
 * Artillery helper functions for Discovery Map load testing.
 *
 * Provides custom utility hooks and data generators for the
 * discovery-map.load.yml test suite.
 */

/**
 * Generate a random UUID v4 string for dynamic test data.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a random latitude within the given bounds.
 * @param {number} min - Minimum latitude (default -90)
 * @param {number} max - Maximum latitude (default 90)
 * @returns {number}
 */
function generateRandomLatitude(min, max) {
  const lo = min ?? -90;
  const hi = max ?? 90;
  return parseFloat((Math.random() * (hi - lo) + lo).toFixed(6));
}

/**
 * Generate a random longitude within the given bounds.
 * @param {number} min - Minimum longitude (default -180)
 * @param {number} max - Maximum longitude (default 180)
 * @returns {number}
 */
function generateRandomLongitude(min, max) {
  const lo = min ?? -180;
  const hi = max ?? 180;
  return parseFloat((Math.random() * (hi - lo) + lo).toFixed(6));
}

/**
 * Pick a random element from a context variable array.
 * Artillery replaces "{{ arrName }}" with one element from the array,
 * but this helper allows explicit random selection when needed.
 */
function pickRandomArrayItem(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Called before each request in a scenario flow.
 * Injects a correlation ID for tracing load-test requests in server logs.
 */
function beforeRequest(requestParams, context, events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      context.vars.loadTestId || `discovery-load-${Date.now()}`;
  }
  return next();
}

module.exports = {
  generateUUID,
  generateRandomLatitude,
  generateRandomLongitude,
  pickRandomArrayItem,
  beforeRequest,
};