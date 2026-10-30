import {
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Bounds for one interface-translation request.
 *
 * The browser sends the English interface dictionary in batches, so a request
 * never needs to carry the whole dictionary. Keeping every request small bounds
 * the provider cost of a single call and keeps each body far below the global
 * JSON parser limit. `UI_TRANSLATION_BATCH_SIZE` in the frontend I18nService
 * must stay at or below `maxEntries`.
 */
export const UI_DICTIONARY_LIMITS = {
  maxEntries: 500,
  maxKeyLength: 200,
  maxValueLength: 2000,
  maxTotalCharacters: 100_000,
} as const;

/** BCP 47 style tag, matching the pattern used by TranslateDto. */
export const UI_LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/** Keys that could be used to tamper with object prototypes. */
const FORBIDDEN_DICTIONARY_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * True when the value is a bounded dictionary of non-empty keys to strings.
 * Exported so the contract can be unit tested without a DTO instance.
 */
export function isBoundedUiDictionary(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;

  const entries = Object.entries(value);
  if (
    entries.length === 0 ||
    entries.length > UI_DICTIONARY_LIMITS.maxEntries
  ) {
    return false;
  }

  let totalCharacters = 0;
  for (const [key, text] of entries) {
    if (
      key.length === 0 ||
      key.length > UI_DICTIONARY_LIMITS.maxKeyLength ||
      FORBIDDEN_DICTIONARY_KEYS.has(key) ||
      typeof text !== 'string' ||
      text.length > UI_DICTIONARY_LIMITS.maxValueLength
    ) {
      return false;
    }
    totalCharacters += text.length;
    if (totalCharacters > UI_DICTIONARY_LIMITS.maxTotalCharacters) {
      return false;
    }
  }
  return true;
}

function IsBoundedUiDictionary(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isBoundedUiDictionary',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean => isBoundedUiDictionary(value),
        defaultMessage: (): string =>
          `dictionary must map 1 to ${UI_DICTIONARY_LIMITS.maxEntries} safe keys to strings ` +
          `(key up to ${UI_DICTIONARY_LIMITS.maxKeyLength}, value up to ${UI_DICTIONARY_LIMITS.maxValueLength}, ` +
          `${UI_DICTIONARY_LIMITS.maxTotalCharacters} characters in total)`,
      },
    });
  };
}

export class TranslateUiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(35)
  @Matches(UI_LANGUAGE_TAG_PATTERN)
  target_language!: string;

  @IsObject()
  @IsBoundedUiDictionary()
  dictionary!: Record<string, string>;
}
