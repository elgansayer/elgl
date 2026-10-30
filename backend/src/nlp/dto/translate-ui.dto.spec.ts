import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  isBoundedUiDictionary,
  TranslateUiDto,
  UI_DICTIONARY_LIMITS,
} from './translate-ui.dto';

async function errorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(TranslateUiDto, payload);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

function dictionaryOf(size: number, valueLength = 5): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: size }, (_, index) => [
      `section.key${index}`,
      'a'.repeat(valueLength),
    ]),
  );
}

describe('TranslateUiDto', () => {
  it('accepts a language tag with a small dictionary', async () => {
    await expect(
      errorsFor({
        target_language: 'ar',
        dictionary: { 'nav.home': 'Home', 'common.coins': '{{coins}} Coins' },
      }),
    ).resolves.toEqual([]);
  });

  it.each(['pt-BR', 'zh-Hant-TW', 'ckb', 'es-419'])(
    'accepts the BCP 47 style language tag %s',
    async (target_language) => {
      await expect(
        errorsFor({ target_language, dictionary: { a: 'b' } }),
      ).resolves.toEqual([]);
    },
  );

  it.each([
    '',
    'english',
    'en_GB',
    'en--GB',
    '<script>',
    'ar; DROP TABLE users',
    `ar-${'x'.repeat(40)}`,
  ])('rejects the invalid language tag %j', async (target_language) => {
    await expect(
      errorsFor({ target_language, dictionary: { a: 'b' } }),
    ).resolves.toContain('target_language');
  });

  it('rejects a missing language tag', async () => {
    await expect(errorsFor({ dictionary: { a: 'b' } })).resolves.toContain(
      'target_language',
    );
  });

  it.each([
    ['an empty dictionary', {}],
    ['an array', ['Home']],
    ['null', null],
    ['a string', 'Home'],
    ['a non-string value', { 'nav.home': 42 }],
    ['a nested object value', { 'nav.home': { text: 'Home' } }],
    ['an empty key', { '': 'Home' }],
  ])('rejects %s as the dictionary', async (_label, dictionary) => {
    await expect(
      errorsFor({ target_language: 'es', dictionary }),
    ).resolves.toContain('dictionary');
  });

  it('rejects keys that could tamper with object prototypes', () => {
    const polluted: unknown = JSON.parse('{"__proto__": "Home"}');
    expect(isBoundedUiDictionary(polluted)).toBe(false);
    expect(isBoundedUiDictionary({ constructor: 'Home' })).toBe(false);
    expect(isBoundedUiDictionary({ prototype: 'Home' })).toBe(false);
  });

  it('rejects objects that are not plain records', () => {
    expect(isBoundedUiDictionary(new Map([['a', 'b']]))).toBe(false);
    expect(isBoundedUiDictionary(Object.create({ a: 'b' }))).toBe(false);
    expect(isBoundedUiDictionary(new (class Dictionary {})())).toBe(false);
  });

  it('accepts exactly the maximum number of entries and rejects one more', async () => {
    const limit = UI_DICTIONARY_LIMITS.maxEntries;

    await expect(
      errorsFor({ target_language: 'es', dictionary: dictionaryOf(limit) }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor({ target_language: 'es', dictionary: dictionaryOf(limit + 1) }),
    ).resolves.toContain('dictionary');
  });

  it('bounds the length of keys and values', () => {
    expect(
      isBoundedUiDictionary({
        ['k'.repeat(UI_DICTIONARY_LIMITS.maxKeyLength)]: 'ok',
      }),
    ).toBe(true);
    expect(
      isBoundedUiDictionary({
        ['k'.repeat(UI_DICTIONARY_LIMITS.maxKeyLength + 1)]: 'ok',
      }),
    ).toBe(false);
    expect(
      isBoundedUiDictionary({
        key: 'v'.repeat(UI_DICTIONARY_LIMITS.maxValueLength),
      }),
    ).toBe(true);
    expect(
      isBoundedUiDictionary({
        key: 'v'.repeat(UI_DICTIONARY_LIMITS.maxValueLength + 1),
      }),
    ).toBe(false);
  });

  it('bounds the total number of characters a single request can send to a provider', () => {
    const valueLength = 1000;
    const allowedEntries =
      UI_DICTIONARY_LIMITS.maxTotalCharacters / valueLength;

    expect(
      isBoundedUiDictionary(dictionaryOf(allowedEntries, valueLength)),
    ).toBe(true);
    expect(
      isBoundedUiDictionary(dictionaryOf(allowedEntries + 1, valueLength)),
    ).toBe(false);
  });

  it('keeps a full batch of typical interface strings under the 100 KiB JSON body limit', () => {
    // The whole English dictionary is about 110 KB and was rejected with HTTP
    // 413. A full-size batch of typical strings must stay far below the limit.
    const body = JSON.stringify({
      target_language: 'ar',
      dictionary: dictionaryOf(UI_DICTIONARY_LIMITS.maxEntries, 60),
    });

    expect(Buffer.byteLength(body)).toBeLessThan(100 * 1024);
  });
});
