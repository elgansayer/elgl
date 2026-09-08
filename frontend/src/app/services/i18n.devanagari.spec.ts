import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

const complexScriptFixtures = [
  ['hi', 'हिन्दी भाषा सीखना'],
  ['bn', 'বাংলা ভাষা শেখা'],
  ['ta', 'தமிழ் மொழி கற்பது'],
  ['th', 'เรียนภาษาไทย'],
  ['km', 'រៀនភាសាខ្មែរ'],
] as const;

describe('Devanagari and complex-script rendering contract', () => {
  let service: I18nService;
  let testDocument: Document;

  beforeEach(() => {
    localStorage.clear();
    testDocument = document.implementation.createHTMLDocument();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DOCUMENT, useValue: testDocument },
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockResolvedValue('test-token') },
        },
      ],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    testDocument.documentElement.lang = 'en-GB';
    testDocument.documentElement.dir = 'ltr';
    testDocument.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('keeps Hindi language semantics and LTR direction intact in %s mode', async (_mode, darkMode) => {
    testDocument.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('hellotalk_dict_hi', JSON.stringify({}));

    const languageChange = service.setLanguage('hi');
    expect(testDocument.documentElement.classList.contains('dark')).toBe(darkMode);
    await languageChange;

    expect(service.currentLang()).toBe('hi');
    expect(service.direction()).toBe('ltr');
    expect(testDocument.documentElement.lang).toBe('hi');
    expect(testDocument.documentElement.dir).toBe('ltr');
    const hindi = service.availableLanguages.find((language) => language.code === 'hi');
    expect(hindi).toMatchObject({ nativeName: 'हिन्दी', isRtl: false });
  });

  it.each(complexScriptFixtures)(
    'round-trips %s content through grapheme and word segmentation without rewriting source text',
    (language, text) => {
      const graphemes = Array.from(
        new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(text),
      );
      const words = Array.from(new Intl.Segmenter(language, { granularity: 'word' }).segment(text));

      expect(graphemes.map((segment) => segment.segment).join('')).toBe(text);
      expect(words.map((segment) => segment.segment).join('')).toBe(text);
      expect(words.some((segment) => segment.isWordLike)).toBe(true);
    },
  );

  it('treats a Devanagari base plus vowel sign as one user-perceived grapheme', () => {
    const text = 'कि';
    const graphemes = Array.from(new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(text));

    expect(Array.from(text)).toHaveLength(2);
    expect(graphemes).toHaveLength(1);
    expect(graphemes[0]?.segment).toBe(text);
  });
});
