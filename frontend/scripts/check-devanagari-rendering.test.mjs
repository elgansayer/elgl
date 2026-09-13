import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const i18nSource = await readFile(new URL('../src/app/services/i18n.service.ts', import.meta.url), 'utf8');

const complexScriptFixtures = [
  ['hi', 'हिन्दी भाषा सीखना'],
  ['bn', 'বাংলা ভাষা শেখা'],
  ['ta', 'தமிழ் மொழி கற்பது'],
  ['th', 'เรียนภาษาไทย'],
  ['km', 'រៀនភាសាខ្មែរ'],
];

test('Hindi remains a Devanagari-authored LTR application language', () => {
  assert.match(
    i18nSource,
    /\{\s*code:\s*'hi',\s*name:\s*'Hindi',\s*nativeName:\s*'हिन्दी',\s*flag:\s*'🇮🇳',\s*isRtl:\s*false\s*\}/,
  );
});

test('document language and direction remain locale-owned and theme-independent', () => {
  const method = i18nSource.match(
    /private applyDocumentRtlAndLocale\(lang: string\): void \{(?<body>[\s\S]*?)\n  \}/,
  )?.groups?.body;

  assert.ok(method, 'Expected I18nService.applyDocumentRtlAndLocale() to remain present');
  assert.match(method, /document\.documentElement\.lang\s*=\s*lang/);
  assert.match(method, /\['ar', 'he', 'fa', 'ur'\]\.includes\(lang\.toLowerCase\(\)\)/);
  assert.match(method, /document\.documentElement\.dir\s*=\s*isRtlLang\s*\?\s*'rtl'\s*:\s*'ltr'/);
  assert.doesNotMatch(method, /classList|dark|theme/i);
});

for (const [language, text] of complexScriptFixtures) {
  test(`${language} word and grapheme segmentation preserves exact source text`, () => {
    const graphemes = Array.from(
      new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(text),
    );
    const words = Array.from(new Intl.Segmenter(language, { granularity: 'word' }).segment(text));

    assert.equal(
      graphemes.map((segment) => segment.segment).join(''),
      text,
      `${language} grapheme segmentation must not rewrite content`,
    );
    assert.equal(
      words.map((segment) => segment.segment).join(''),
      text,
      `${language} word segmentation must not rewrite content`,
    );
    assert.ok(words.some((segment) => segment.isWordLike), `${language} should expose word-like segments`);
  });
}

test('a Devanagari base plus dependent vowel sign is one grapheme cluster', () => {
  const text = 'कि';
  const graphemes = Array.from(new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(text));

  assert.equal(Array.from(text).length, 2);
  assert.equal(graphemes.length, 1);
  assert.equal(graphemes[0]?.segment, text);
});
