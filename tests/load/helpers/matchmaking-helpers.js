/**
 * Artillery helper functions for Matchmaking Algorithm load testing.
 *
 * Provides custom utility hooks and data generators for the
 * matchmaking.load.yml test suite.
 */

/**
 * Called before each request in a scenario flow.
 * Injects a correlation ID for tracing load-test requests in server logs.
 */
function beforeRequest(requestParams, context, events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      context.vars.loadTestId || `matchmaking-load-${Date.now()}`;
  }
  return next();
}

/**
 * Called after each response. Logs the match tier if present for debugging
 * degraded recommendations during load testing.
 */
function afterResponse(requestParams, response, context, events, next) {
  if (response.body) {
    try {
      const body =
        typeof response.body === 'string'
          ? JSON.parse(response.body)
          : response.body;
      if (Array.isArray(body) && body.length > 0) {
        const tier = body[0].matchTier;
        if (tier && tier !== 'interest') {
          events.emit(
            'counter',
            `matchmaking.tier.${tier}`,
            1,
          );
        }
      }
    } catch {
      // Non-JSON response; skip tier tracking
    }
  }
  return next();
}

module.exports = {
  beforeRequest,
  afterResponse,
};