import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractKeysFromSource,
  isStubOrKeyCopy,
  REQUIRED_PASSWORD_KEYS,
  stripComments,
  validateI18nCoverage,
} from './check-i18n-coverage.mjs';

test('stripComments strips HTML comments properly', () => {
  const html = '<div><!-- comment with \'ignore.key\' | t --><span>{{ \'real.key\' | t }}</span></div>';
  const stripped = stripComments(html, true);
  assert.ok(!stripped.includes('ignore.key'));
  assert.ok(stripped.includes('real.key'));
});

test('stripComments strips TypeScript single-line and multi-line comments', () => {
  const ts = `
    // this.i18n.translate('single.comment.key')
    /*
      multi line 'multi.comment.key' | t
    */
    const k = this.i18n.translate('real.ts.key');
  `;
  const stripped = stripComments(ts, false);
  assert.ok(!stripped.includes('single.comment.key'));
  assert.ok(!stripped.includes('multi.comment.key'));
  assert.ok(stripped.includes('real.ts.key'));
});

test('extractKeysFromSource extracts template pipe and programmatic calls', () => {
  const tpl = `
    <h1>{{ 'header.title' | t }}</h1>
    <span [attr.aria-label]="'label.aria' | translate">icon</span>
  `;
  const keys = extractKeysFromSource(tpl, true);
  assert.equal(keys.has('header.title'), true);
  assert.equal(keys.has('label.aria'), true);

  const code = `
    const a = this.i18n.translate('service.call.one');
    const b = i18n.t('service.call.two');
    const c = t('service.call.three');
  `;
  const tsKeys = extractKeysFromSource(code, false);
  assert.equal(tsKeys.has('service.call.one'), true);
  assert.equal(tsKeys.has('service.call.two'), true);
  assert.equal(tsKeys.has('service.call.three'), true);
});

test('extractKeysFromSource ignores dynamic concatenation suffixes starting with dot', () => {
  const source = `
    {{ 'giftModal.package.' + pkg.id + '.title' | t }}
    {{ 'giftModal.package.' + pkg.id + '.desc' | t }}
  `;
  const keys = extractKeysFromSource(source, true);
  assert.equal(keys.has('.title'), false);
  assert.equal(keys.has('.desc'), false);
});

test('isStubOrKeyCopy flags generic and invalid unlocalised copy', () => {
  assert.equal(isStubOrKeyCopy('any.key', 'Title'), true);
  assert.equal(isStubOrKeyCopy('any.key', 'Description'), true);
  assert.equal(isStubOrKeyCopy('any.key', 'Delete Button'), true);
  assert.equal(isStubOrKeyCopy('any.key', 'Export Description'), true);
  assert.equal(isStubOrKeyCopy('auth.login_google', 'Login google'), true);
  assert.equal(isStubOrKeyCopy('events.title', 'Event Title'), true);

  // Valid English copy
  assert.equal(isStubOrKeyCopy('events.title', 'Events'), false);
  assert.equal(isStubOrKeyCopy('account_deletion.delete_button', 'Schedule Account Deletion'), false);
  assert.equal(isStubOrKeyCopy('common.close', 'Close'), false);
});

test('validateI18nCoverage fails when a used key is missing', () => {
  const usedKeys = new Map([['missing.key', new Set(['test.html'])]]);
  const baseDictionary = { 'present.key': 'Hello' };
  const errors = validateI18nCoverage({
    baseDictionary,
    usedKeys,
  });
  assert.ok(errors.some((e) => e.includes('Missing key in baseDictionary: "missing.key"')));
});

test('validateI18nCoverage fails when a key has an unlocalised value', () => {
  const usedKeys = new Map([['some.title', new Set(['test.html'])]]);
  const baseDictionary = { 'some.title': 'Title' };
  const errors = validateI18nCoverage({
    baseDictionary,
    usedKeys,
  });
  assert.ok(errors.some((e) => e.includes('raw unlocalised key value: "Title"')));
});

test('validateI18nCoverage fails when English copy contains banned em or en dashes', () => {
  const usedKeys = new Map();
  const baseDictionary = {
    'dash.em': 'Text \u2014 with em dash',
    'dash.en': 'Text \u2013 with en dash',
  };
  const errors = validateI18nCoverage({
    baseDictionary,
    usedKeys,
  });
  assert.ok(errors.some((e) => e.includes('contains banned em dash')));
  assert.ok(errors.some((e) => e.includes('contains banned en dash')));
});

test('validateI18nCoverage checks password.* presence in en-GB, ja, and ar', () => {
  const usedKeys = new Map();
  const baseDictionary = {};
  for (const k of REQUIRED_PASSWORD_KEYS) {
    baseDictionary[k] = 'Valid English password text';
  }
  const jaDict = {}; // empty
  const arDict = {}; // empty

  const errors = validateI18nCoverage({
    baseDictionary,
    usedKeys,
    jaDictionary: jaDict,
    arDictionary: arDict,
  });

  assert.ok(errors.some((e) => e.includes('missing in ja.json')));
  assert.ok(errors.some((e) => e.includes('missing in ar.json')));
});

test('validateI18nCoverage passes when all conditions are satisfied', () => {
  const usedKeys = new Map([
    ['app.welcome', new Set(['home.html'])],
  ]);
  const baseDictionary = {
    'app.welcome': 'Welcome to Relay',
  };
  const jaDict = {};
  const arDict = {};
  for (const k of REQUIRED_PASSWORD_KEYS) {
    baseDictionary[k] = 'Password field';
    jaDict[k] = 'パスワード';
    arDict[k] = 'كلمة المرور';
  }

  const errors = validateI18nCoverage({
    baseDictionary,
    usedKeys,
    jaDictionary: jaDict,
    arDictionary: arDict,
  });
  assert.deepEqual(errors, []);
});
