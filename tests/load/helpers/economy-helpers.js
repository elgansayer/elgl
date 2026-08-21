/**
 * Artillery helper functions for Virtual Coin Economy load testing.
 *
 * Provides custom utility hooks and data generators for the
 * economy.load.yml test suite.
 */

/** Pool of vocabulary words in various languages */
const WORD_POOL = [
  { token: 'bonjour', translation: 'hello', lang: 'French' },
  { token: 'hola', translation: 'hello', lang: 'Spanish' },
  { token: 'ciao', translation: 'hello/goodbye', lang: 'Italian' },
  { token: 'guten_tag', translation: 'good day', lang: 'German' },
  { token: 'konnichiwa', translation: 'hello/good afternoon', lang: 'Japanese' },
  { token: 'annyeonghaseyo', translation: 'hello', lang: 'Korean' },
  { token: 'nihao', translation: 'hello', lang: 'Chinese' },
  { token: 'namaste', translation: 'hello/greetings', lang: 'Hindi' },
  { token: 'salaam', translation: 'peace/hello', lang: 'Arabic' },
  { token: 'ola', translation: 'hello', lang: 'Portuguese' },
  { token: 'merhaba', translation: 'hello', lang: 'Turkish' },
  { token: 'hei', translation: 'hi', lang: 'Finnish' },
  { token: 'szia', translation: 'hi/bye', lang: 'Hungarian' },
  { token: 'tere', translation: 'hello', lang: 'Estonian' },
  { token: 'hej', translation: 'hello', lang: 'Swedish' },
  { token: 'hallo', translation: 'hello', lang: 'Dutch' },
  { token: 'salut', translation: 'hi', lang: 'French' },
  { token: 'privet', translation: 'hi', lang: 'Russian' },
  { token: 'yassou', translation: 'hello', lang: 'Greek' },
  { token: 'shalom', translation: 'peace/hello', lang: 'Hebrew' },
];

const TRANSLATIONS = ['hello', 'good day', 'greetings', 'hi', 'hey', 'good morning'];

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
 * Pick a random word from the vocabulary pool.
 * Returns an object with token, translation, and context sentence suitable for flashcard creation.
 */
function generateFlashcardPayload(ctx, events, done) {
  const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  const translation = TRANSLATIONS[Math.floor(Math.random() * TRANSLATIONS.length)];
  ctx.vars.word_token = `${word.token}_${generateUUID().slice(0, 8)}`;
  ctx.vars.word_translation = translation;
  ctx.vars.word_context = `I said "${word.token}" to my ${word.lang} language partner at ${new Date().toISOString()}`;
  ctx.vars.word_definition = `A common greeting in ${word.lang}`;
  ctx.vars.pronunciation_url = `https://audio.example.com/pron/${word.token}.mp3`;
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
  generateFlashcardPayload,
  beforeRequest,
};