import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const cacheService = read('frontend/src/app/services/translation-cache.service.ts');
const cacheSpec = read('frontend/src/app/services/translation-cache.service.spec.ts');
const chatSpec = read(
  'frontend/src/app/components/chat-room/chat-room.translation-corrections.spec.ts',
);
const momentsSource = read('frontend/src/app/components/moments-feed/moments-feed.component.ts');

test('translation results are cached only in bounded process memory', () => {
  assert.match(cacheService, /new Map<string, TranslationCacheEntry>\(\)/);
  assert.match(cacheService, /MAX_CACHE_ENTRIES = 500/);
  assert.match(cacheService, /MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(cacheService, /localStorage|sessionStorage|indexedDB/i);

  assert.match(cacheSpec, /never writes private translation content to localStorage/);
  assert.match(cacheSpec, /does not persist translations into a fresh service instance/);
  assert.match(cacheSpec, /evicts the least recently used entry/);
});

test('chat can hide and show a translation without another provider request', () => {
  assert.match(chatSpec, /uses a cached translation without sending private text to the provider again/);
  assert.match(chatSpec, /toggles an already translated message without another network request/);
  assert.match(chatSpec, /expect\(translateText\)\.toHaveBeenCalledTimes\(1\)/);
  assert.match(chatSpec, /expect\(cacheGet\)\.toHaveBeenCalledWith\('Bonjour tout le monde', 'en'\)/);
});

test('Moments uses the shared translation cache before requesting another translation', () => {
  const cacheLookup = momentsSource.indexOf('this.translationCacheService.get(');
  const providerRequest = momentsSource.indexOf('this.vocabStore.translateWordOrSentence(', cacheLookup);
  const cacheWrite = momentsSource.indexOf('this.translationCacheService.set(', providerRequest);

  assert.ok(cacheLookup >= 0, 'Moments must read TranslationCacheService');
  assert.ok(providerRequest > cacheLookup, 'Moments must check the cache before calling the provider');
  assert.ok(cacheWrite > providerRequest, 'successful provider output must be written to the shared cache');
  assert.match(momentsSource, /if \(currentlyShowing\)[\s\S]*showTranslationMap\.update/);
  assert.match(momentsSource, /if \(this\.translationCache\(\)\[cacheKey\]\)[\s\S]*return;/);
});

test('cache identity includes both exact source text and target language', () => {
  assert.match(cacheService, /JSON\.stringify\(\[normalizedTarget, text\]\)/);
  assert.match(cacheSpec, /stores and retrieves an exact source\/target translation in memory/);
  assert.match(cacheSpec, /normalizes target-language casing and surrounding whitespace/);
});
