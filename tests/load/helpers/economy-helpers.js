/**
 * Artillery helper functions for Virtual Coin Economy load testing.
 *
 * Provides custom utility hooks and data generators for the
 * economy.load.yml test suite.
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
 * Called before each request in a scenario flow.
 * Injects a correlation ID for tracing load-test requests in server logs.
 */
function beforeRequest(requestParams, context, events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      context.vars.loadTestId || `load-${Date.now()}`;
  }
  return next();
}

module.exports = {
  generateUUID,
  beforeRequest,
};