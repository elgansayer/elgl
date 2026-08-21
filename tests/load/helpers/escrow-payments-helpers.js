/**
 * Artillery helper functions for Escrow Payments load testing.
 *
 * Provides custom utility hooks and data generators for the
 * escrow-payments.load.yml test suite.
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
 * Generate a random transaction reference string.
 */
function generateTransactionRef(userContext, events, done) {
  userContext.vars.transaction_ref = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  return done();
}

/**
 * Generate escrow payload data with randomised amounts and currencies.
 */
function generateEscrowPayload(userContext, events, done) {
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY'];
  const amounts = [5, 10, 15, 20, 25, 50, 100, 200];
  userContext.vars.escrow_amount = amounts[Math.floor(Math.random() * amounts.length)] * 100;
  userContext.vars.escrow_currency = currencies[Math.floor(Math.random() * currencies.length)];
  userContext.vars.recipient_id = generateUUID();
  userContext.vars.escrow_description = `Language lesson payment - load test ${Date.now()}`;
  userContext.vars.milestone_count = Math.floor(Math.random() * 5) + 1;
  return done();
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
  generateTransactionRef,
  generateEscrowPayload,
  beforeRequest,
};