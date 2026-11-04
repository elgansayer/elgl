import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Interface locale as sent by the web client: a BCP 47 style tag such as `es`,
 * `en-GB` or `zh-Hans-CN`. The pattern excludes ":" and whitespace so the value
 * is safe to embed in cache keys and provider requests.
 */
export const UI_LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
export const MAX_UI_LOCALE_LENGTH = 35;

/**
 * Bounds for the English source dictionary the client submits for translation.
 * The entry and key limits mirror the guards in the frontend
 * `ui-language-preference.service.ts`, which rejects larger dictionaries anyway.
 * The character budget caps what one request can ask the paid translation
 * provider to process; the shipped dictionary is roughly 50,000 characters.
 */
export const MAX_UI_DICTIONARY_ENTRIES = 5_000;
export const MAX_UI_DICTIONARY_KEY_LENGTH = 200;
export const MAX_UI_DICTIONARY_VALUE_LENGTH = 2_000;
export const MAX_UI_DICTIONARY_TOTAL_CHARACTERS = 250_000;

const FORBIDDEN_DICTIONARY_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

@ValidatorConstraint({ name: 'boundedUiDictionary', async: false })
export class BoundedUiDictionaryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const entries = Object.entries(value);
    if (entries.length === 0 || entries.length > MAX_UI_DICTIONARY_ENTRIES) {
      return false;
    }

    let totalCharacters = 0;
    for (const [key, text] of entries) {
      if (
        key.length === 0 ||
        key.length > MAX_UI_DICTIONARY_KEY_LENGTH ||
        FORBIDDEN_DICTIONARY_KEYS.has(key)
      ) {
        return false;
      }
      if (
        typeof text !== 'string' ||
        text.length > MAX_UI_DICTIONARY_VALUE_LENGTH
      ) {
        return false;
      }
      totalCharacters += text.length;
      if (totalCharacters > MAX_UI_DICTIONARY_TOTAL_CHARACTERS) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return (
      `dictionary must contain 1 to ${MAX_UI_DICTIONARY_ENTRIES} entries with ` +
      `keys up to ${MAX_UI_DICTIONARY_KEY_LENGTH} characters, string values up to ` +
      `${MAX_UI_DICTIONARY_VALUE_LENGTH} characters, and at most ` +
      `${MAX_UI_DICTIONARY_TOTAL_CHARACTERS} characters in total`
    );
  }
}

export class TranslateUiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_UI_LOCALE_LENGTH)
  @Matches(UI_LOCALE_PATTERN, {
    message: 'target_language must be a locale tag such as "es" or "en-GB"',
  })
  target_language!: string;

  // Declaring the nested type stops class-transformer inferring it from an own
  // "constructor" key, which would otherwise throw while transforming the body.
  @Type(() => Object)
  @IsObject()
  @IsNotEmpty()
  @Validate(BoundedUiDictionaryConstraint)
  dictionary!: Record<string, string>;
}
