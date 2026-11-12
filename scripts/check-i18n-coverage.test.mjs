import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectUsedKeys,
  extractUsedKeys,
  isKeyDerivedCopy,
  parseDictionarySource,
  readBaseDictionary,
} from './i18n-english-lib.mjs';

test('parses single, multi-line and concatenated dictionary entries', () => {
  const source = `
    private readonly baseDictionary: Record<string, string> = {
      'app.title': 'HelloTalk',
      'cart.empty':
        'Your cart is empty',
      'profile.name': 'Hello ' + 'there',
      'profile.apostrophe': 'View {{name}}\\'s profile',
    };

  readonly translations = signal<Record<string, string>>({ ...this.baseDictionary });
  `;
  const dictionary = parseDictionarySource(source);
  assert.equal(dictionary.get('app.title'), 'HelloTalk');
  assert.equal(dictionary.get('cart.empty'), 'Your cart is empty');
  assert.equal(dictionary.get('profile.name'), 'Hello there');
  assert.equal(dictionary.get('profile.apostrophe'), "View {{name}}'s profile");
});

test('extracts keys from pipes and translate calls without requiring a dot', () => {
  const keys = extractUsedKeys(`
    {{ 'nav.shop' | t }}
    {{ 'loading' | t }}
    this.i18n.translate('common.retry');
    const label = t('groups_discovery_join');
  `);
  assert.deepEqual([...keys].sort(), [
    'common.retry',
    'groups_discovery_join',
    'loading',
    'nav.shop',
  ]);
});

test('flags copy generated from the key name', () => {
  assert.equal(isKeyDerivedCopy('account_deletion.title', 'Title'), true);
  assert.equal(isKeyDerivedCopy('cart.empty', 'Empty'), true);
  assert.equal(isKeyDerivedCopy('deviceLock.title', 'Title'), true);
  assert.equal(isKeyDerivedCopy('auth.login_google', 'Login google'), true);
  assert.equal(isKeyDerivedCopy('admin.users.searchLabel', 'Search Label'), true);
  assert.equal(isKeyDerivedCopy('events.title', 'Event Title'), true);
  assert.equal(isKeyDerivedCopy('common.retry', 'Retry'), false);
  assert.equal(isKeyDerivedCopy('events.description', 'What is this event about?'), false);
  assert.equal(isKeyDerivedCopy('raw.key', 'raw.key'), true);
  assert.equal(isKeyDerivedCopy('blank.key', '   '), true);
});

test('the live dictionary covers every used key and has no key-derived copy', () => {
  const dictionary = readBaseDictionary();
  const missing = [];
  for (const key of collectUsedKeys().keys()) {
    if (!dictionary.has(key)) missing.push(key);
  }
  const derivedCopy = [];
  for (const [key, value] of dictionary) {
    if (isKeyDerivedCopy(key, value)) derivedCopy.push(key);
  }
  assert.deepEqual(missing, [], 'used keys without English copy');
  assert.deepEqual(derivedCopy, [], 'dictionary entries with key-derived copy');
});
