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
 * Artillery step function that generates a random latitude (-90 to 90),
 * stores it in context.vars.latitude, and continues the scenario.
 */
function generateRandomLatitude(userContext, events, done) {
  userContext.vars.latitude = parseFloat((Math.random() * 180 - 90).toFixed(6));
  return done();
}

/**
 * Artillery step function that generates a random longitude (-180 to 180),
 * stores it in context.vars.longitude, and continues the scenario.
 */
function generateRandomLongitude(userContext, events, done) {
  userContext.vars.longitude = parseFloat(
    (Math.random() * 360 - 180).toFixed(6),
  );
  return done();
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