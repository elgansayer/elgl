/**
 * Artillery helper functions for LingQ Reading Engine load testing.
 *
 * Covers the Curated Content, NLP, and SRS Flashcards endpoints
 * that together constitute the LingQ-style interactive reading engine.
 */

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Injects a correlation header for tracing load-test requests in server logs.
 */
function beforeRequest(requestParams, context, events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      context.vars.loadTestId || `lingq-reading-${Date.now()}`;
  }
  return next();
}

module.exports = {
  generateUUID,
  beforeRequest,
};