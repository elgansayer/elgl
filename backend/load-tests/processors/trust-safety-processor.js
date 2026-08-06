/**
 * Artillery processor – Trust & Safety load tests.
 *
 * Hooks into Artillery's lifecycle to generate randomised payload data,
 * track metrics, and handle any pre/post flow logic.
 *
 * Available hooks (called from the Artillery YAML):
 *   - beforeRequest  (req, context, ee, next)
 *   - afterResponse  (req, res, context, ee, next)
 *   - function       (userContext, events, done)
 */

/** Generate an idempotency-safe block/unblock payload. */
function makeBlockPayload(userContext, _events, done) {
  const uid = `lt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  userContext.vars.blocked_id = uid;
  return done();
}

module.exports = {
  makeBlockPayload,
};