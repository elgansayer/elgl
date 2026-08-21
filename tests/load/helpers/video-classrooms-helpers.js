/**
 * Artillery helper functions for Video Classrooms load testing.
 *
 * Provides custom utility hooks and data generators for the
 * video-classrooms.load.yml test suite.
 */

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function beforeRequest(requestParams, context, events, next) {
  if (requestParams.headers) {
    requestParams.headers['X-Load-Test-Id'] =
      context.vars.loadTestId || `video-classrooms-load-${Date.now()}`;
  }
  return next();
}

module.exports = {
  generateUUID,
  beforeRequest,
};