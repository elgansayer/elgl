import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BoundedUiDictionaryConstraint,
  MAX_UI_DICTIONARY_ENTRIES,
  MAX_UI_DICTIONARY_KEY_LENGTH,
  MAX_UI_DICTIONARY_TOTAL_CHARACTERS,
  MAX_UI_DICTIONARY_VALUE_LENGTH,
  MAX_UI_LOCALE_LENGTH,
  TranslateUiDto,
} from './translate-ui.dto';

async function failingProperties(payload: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(TranslateUiDto, payload));
  return errors.map((error) => error.property);
}

describe('TranslateUiDto', () => {
  const dictionary = { 'nav.discover': 'Discover', 'common.save': 'Save' };

  describe('target_language', () => {
    it.each(['es', 'en-GB', 'pt-BR', 'zh-Hans', 'zh-Hans-CN', 'fil', 'AR'])(
      'accepts the locale tag %s',
      async (target_language) => {
        await expect(
          failingProperties({ target_language, dictionary }),
        ).resolves.toEqual([]);
      },
    );

    it.each([
      ['an empty string', ''],
      ['a single letter', 'e'],
      ['a number', 42],
      ['a missing value', undefined],
      ['an object', { code: 'es' }],
      ['a colon that would split a cache key', 'es:admin'],
      ['whitespace', 'es '],
      ['a path traversal attempt', '../es'],
      ['an underscore tag', 'en_GB'],
      ['a redis glob', 'es*'],
      ['a newline injection', 'es\nSET x y'],
      ['too many subtags', 'zh-Hans-CN-x-private-extra'],
    ])('rejects %s', async (_label, target_language) => {
      await expect(
        failingProperties({ target_language, dictionary }),
      ).resolves.toContain('target_language');
    });

    it('rejects a tag longer than the locale length limit', async () => {
      const target_language = `en-${'a'.repeat(MAX_UI_LOCALE_LENGTH)}`;

      await expect(
        failingProperties({ target_language, dictionary }),
      ).resolves.toContain('target_language');
    });
  });

  describe('dictionary', () => {
    const valid = (extra: Record<string, unknown> = {}) => ({
      target_language: 'es',
      dictionary: { ...dictionary, ...extra },
    });

    it('accepts a typical interface dictionary', async () => {
      await expect(failingProperties(valid())).resolves.toEqual([]);
    });

    it.each([
      ['a missing dictionary', undefined],
      ['null', null],
      ['an empty dictionary', {}],
      ['an array', ['Save']],
      ['a string', 'Save'],
    ])('rejects %s', async (_label, value) => {
      await expect(
        failingProperties({ target_language: 'es', dictionary: value }),
      ).resolves.toContain('dictionary');
    });

    it.each([
      ['a number', 7],
      ['null', null],
      ['a nested object', { nested: 'x' }],
      ['an array', ['x']],
      ['a boolean', true],
    ])('rejects a value that is %s', async (_label, value) => {
      await expect(
        failingProperties(valid({ 'bad.value': value })),
      ).resolves.toContain('dictionary');
    });

    it('accepts an empty string value, which the service passes through untranslated', async () => {
      await expect(
        failingProperties(valid({ 'common.blank': '' })),
      ).resolves.toEqual([]);
    });

    it.each(['__proto__', 'constructor'])(
      'does not crash or keep the prototype-sensitive key %s when the body is transformed',
      async (key) => {
        const payload: unknown = JSON.parse(
          `{"target_language":"es","dictionary":{"${key}":"x","nav.discover":"Discover"}}`,
        );

        const dto = plainToInstance(TranslateUiDto, payload);

        expect(Object.keys(dto.dictionary)).not.toContain(key);
        expect(Object.getPrototypeOf(dto.dictionary)).toBe(Object.prototype);
        await expect(validate(dto)).resolves.toEqual([]);
      },
    );

    it.each(['__proto__', 'constructor', 'prototype'])(
      'rejects the prototype-sensitive key %s if it ever reaches validation',
      (key) => {
        const dictionary: unknown = JSON.parse(
          `{"${key}":"x","nav.discover":"Discover"}`,
        );

        expect(new BoundedUiDictionaryConstraint().validate(dictionary)).toBe(
          false,
        );
      },
    );

    it('rejects an empty key', async () => {
      await expect(failingProperties(valid({ '': 'x' }))).resolves.toContain(
        'dictionary',
      );
    });

    it('accepts a key at the length limit and rejects one beyond it', async () => {
      const atLimit = 'k'.repeat(MAX_UI_DICTIONARY_KEY_LENGTH);

      await expect(
        failingProperties(valid({ [atLimit]: 'x' })),
      ).resolves.toEqual([]);
      await expect(
        failingProperties(valid({ [`${atLimit}k`]: 'x' })),
      ).resolves.toContain('dictionary');
    });

    it('accepts a value at the length limit and rejects one beyond it', async () => {
      const atLimit = 'v'.repeat(MAX_UI_DICTIONARY_VALUE_LENGTH);

      await expect(
        failingProperties(valid({ 'long.value': atLimit })),
      ).resolves.toEqual([]);
      await expect(
        failingProperties(valid({ 'long.value': `${atLimit}v` })),
      ).resolves.toContain('dictionary');
    });

    it('accepts the maximum number of entries and rejects one more', async () => {
      const build = (count: number): Record<string, string> =>
        Object.fromEntries(
          Array.from({ length: count }, (_, index) => [`k.${index}`, 'x']),
        );

      await expect(
        failingProperties({
          target_language: 'es',
          dictionary: build(MAX_UI_DICTIONARY_ENTRIES),
        }),
      ).resolves.toEqual([]);
      await expect(
        failingProperties({
          target_language: 'es',
          dictionary: build(MAX_UI_DICTIONARY_ENTRIES + 1),
        }),
      ).resolves.toContain('dictionary');
    });

    it('caps the total characters a single request can send to the translation provider', async () => {
      const perEntry = MAX_UI_DICTIONARY_VALUE_LENGTH;
      const entriesAtBudget = Math.floor(
        MAX_UI_DICTIONARY_TOTAL_CHARACTERS / perEntry,
      );
      const build = (count: number): Record<string, string> =>
        Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            `k.${index}`,
            'x'.repeat(perEntry),
          ]),
        );

      await expect(
        failingProperties({
          target_language: 'es',
          dictionary: build(entriesAtBudget),
        }),
      ).resolves.toEqual([]);
      await expect(
        failingProperties({
          target_language: 'es',
          dictionary: build(entriesAtBudget + 1),
        }),
      ).resolves.toContain('dictionary');
    });

    it('describes the limits in the validation message', async () => {
      const errors = await validate(
        plainToInstance(TranslateUiDto, {
          target_language: 'es',
          dictionary: { a: 1 },
        }),
      );
      const messages = errors.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );

      expect(messages.join(' ')).toContain(
        `${MAX_UI_DICTIONARY_ENTRIES} entries`,
      );
    });
  });
});
