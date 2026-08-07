/**
 * Artillery helper functions for Matchmaking / Discovery load testing.
 *
 * Provides custom utility hooks and data generators for the
 * matchmaking.load.yml test suite.
 *
 * Exercised endpoints:
 *   GET /discovery/partners            - core partner search with filters
 *   GET /discovery/partner-of-week     - cached weekly partner list
 *   GET /discovery/audio-intros        - audio-intro discovery
 *   GET /discovery/recent-native-speakers - recently joined natives
 *   GET /discovery/spotlight           - spotlight users
 *   GET /discovery/language-pair       - language pair matching
 *   GET /discovery/search-by-location  - location-based search
 */

/**
 * Generate a random ISO 639-1 language code for dynamic test data.
 */
function randomLanguageCode() {
  const codes = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'pt', 'it'];
  return codes[Math.floor(Math.random() * codes.length)];
}

/**
 * Generate a random coordinate pair representing a plausible global position.
 */
function randomCoordinates() {
  const lat = (Math.random() * 170 - 85).toFixed(6);
  const lon = (Math.random() * 350 - 175).toFixed(6);
  return { latitude: lat, longitude: lon };
}

/**
 * Called before each request in a scenario flow.
 * Injects a correlation ID for tracing load-test requests in server logs.
 */
function beforeRequest(requestParams, _context, _events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      `matchmaking-load-${Date.now()}`;
  }
  return next();
}

/**
 * Called after each response. Logs non-200 status codes for triage.
 */
function afterResponse(_requestParams, response, _context, _events, next) {
  if (response.statusCode !== 200) {
    console.error(
      `[matchmaking-load] Non-OK response: ${response.statusCode} on ${_requestParams.url}`
    );
  }
  return next();
}

module.exports = {
  randomLanguageCode,
  randomCoordinates,
  beforeRequest,
  afterResponse,
};