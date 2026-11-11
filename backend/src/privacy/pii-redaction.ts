import { randomBytes } from 'node:crypto';
import { isIPv6 } from 'node:net';

/**
 * Deterministic PII masking for text that leaves the platform for a third-party
 * language provider (DeepL, Azure Translator).
 *
 * Contract:
 * - Every detected span is replaced by an opaque, per-call redaction token before the
 *   request is built, so the provider never receives the original value.
 * - The original values are kept only inside the returned {@link ProtectedText}
 *   and are put back into the provider response with `restore`.
 * - A response that lost, invented or garbled a redaction token is rejected (`null`)
 *   instead of being shown with missing or foreign data.
 * - Over-masking is cheap because every value is restored, so detectors favour
 *   recall. Free-form names and postal addresses cannot be recognised without a
 *   statistical model and are intentionally out of scope.
 *
 * Every pattern is linear time: quantifiers are either unambiguous or bounded, and
 * lookbehinds stop a scan from restarting inside a run it already rejected.
 */

/** Providers that receive user text. Used as a low-cardinality label. */
export type PiiProvider = 'deepl' | 'azure';

/** Provider operations that carry user text. Used as a low-cardinality label. */
export type PiiOperation =
  | 'detect_language'
  | 'translate'
  | 'transliterate'
  | 'grammar_check'
  | 'translate_and_correct';

export const PII_CATEGORIES = [
  'url',
  'email',
  'handle',
  'iban',
  'national_id',
  'ip',
  'card',
  'phone',
] as const;

export type PiiCategory = (typeof PII_CATEGORIES)[number];

/**
 * - `clean`: nothing sensitive was found, the text is sent unchanged.
 * - `redacted`: at least one span was replaced by a redaction token.
 * - `skipped`: only sensitive spans were present, so no provider call is needed.
 * - `placeholder_mismatch`: the provider response could not be restored.
 */
export type PiiScrubOutcome =
  'clean' | 'redacted' | 'skipped' | 'placeholder_mismatch';

export interface PiiSummary {
  readonly total: number;
  readonly byCategory: Readonly<Partial<Record<PiiCategory, number>>>;
}

interface Piece {
  readonly pii: boolean;
  readonly value: string;
}

const HAS_CONTENT = /\S/u;
const HAS_LETTER = /\p{L}/u;
const DECIMAL_DIGIT = /\p{Nd}/u;

/** Unicode guarantees decimal digits come in contiguous blocks of ten ordered 0 to 9. */
function digitValue(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint >= 48 && codePoint <= 57) return codePoint - 48;
  let blockStart = codePoint;
  while (DECIMAL_DIGIT.test(String.fromCodePoint(blockStart - 1))) {
    blockStart -= 1;
  }
  return (codePoint - blockStart) % 10;
}

/** Rewrites every Unicode decimal digit (Arabic-Indic, fullwidth, ...) as ASCII. */
function asciiDigitsKeepingSeparators(value: string): string {
  let result = '';
  for (const char of value) {
    result += DECIMAL_DIGIT.test(char) ? String(digitValue(char)) : char;
  }
  return result;
}

function onlyDigits(value: string): string {
  return asciiDigitsKeepingSeparators(value).replace(/\D/gu, '');
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function passesIbanChecksum(iban: string): boolean {
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const value = code >= 65 ? code - 55 : code - 48;
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

interface Accepted {
  /** Number of characters of the regex match that are masked. */
  readonly length: number;
  readonly category: PiiCategory;
}

interface Detector {
  readonly pattern: RegExp;
  readonly classify: (match: string) => Accepted | null;
}

const whole = (category: PiiCategory) => (match: string) => ({
  length: match.length,
  category,
});

const URL_TRAILING_PUNCTUATION = /[.,;:!?)\]}»”’>]+$/u;
const URL_PREFIX_ONLY = /^(?:https?:\/\/|www\.)$/iu;

function classifyUrl(match: string): Accepted | null {
  const trimmed = match.replace(URL_TRAILING_PUNCTUATION, '');
  if (!trimmed || URL_PREFIX_ONLY.test(trimmed)) return null;
  return { length: trimmed.length, category: 'url' };
}

const HANDLE_TRAILING_DOTS = /\.+$/u;

function classifyHandle(match: string): Accepted | null {
  const trimmed = match.replace(HANDLE_TRAILING_DOTS, '');
  return trimmed.length >= 3
    ? { length: trimmed.length, category: 'handle' }
    : null;
}

/** Longest prefix of the candidate that is a checksum-valid IBAN, so trailing words stay readable. */
function classifyIban(match: string): Accepted | null {
  let alphanumerics = '';
  let best = 0;
  for (let i = 0; i < match.length; i += 1) {
    const char = match.charAt(i);
    if (/\s/u.test(char)) continue;
    alphanumerics += char.toUpperCase();
    if (alphanumerics.length > 34) break;
    if (passesIbanChecksum(alphanumerics)) best = i + 1;
  }
  return best > 0 ? { length: best, category: 'iban' } : null;
}

function classifySsn(match: string): Accepted | null {
  const area = Number(match.slice(0, 3));
  const group = Number(match.slice(4, 6));
  const serial = Number(match.slice(7, 11));
  const invalid =
    area === 0 || area === 666 || area >= 900 || group === 0 || serial === 0;
  return invalid ? null : { length: match.length, category: 'national_id' };
}

const INVALID_NINO_PREFIXES: ReadonlySet<string> = new Set([
  'BG',
  'GB',
  'NK',
  'KN',
  'TN',
  'NT',
  'ZZ',
]);

function classifyNino(match: string): Accepted | null {
  return INVALID_NINO_PREFIXES.has(match.slice(0, 2).toUpperCase())
    ? null
    : { length: match.length, category: 'national_id' };
}

function classifyIpv6(match: string): Accepted | null {
  return match.length >= 3 && isIPv6(match)
    ? { length: match.length, category: 'ip' }
    : null;
}

const ISO_OR_DAY_FIRST_DATE =
  /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4})(?!\d)/u;
const DECIMAL_NUMBER = /^\d+[.,]\d+$/u;
const YEAR_RANGE = /^(?:19|20)\d{2}\s*[-\u2010-\u2015]\s*(?:19|20)\d{2}$/u;

/**
 * Classifies a maximal run of digits joined by single separators. Luhn-valid runs of
 * 13 to 19 digits are payment cards. Any other long run is treated as a phone or
 * identifier number, except dates, decimals and year ranges.
 */
function classifyDigitRun(match: string): Accepted | null {
  const normalised = asciiDigitsKeepingSeparators(match);
  const digits = normalised.replace(/\D/gu, '');
  const core = normalised.replace(/^[+(]/u, '');

  if (DECIMAL_NUMBER.test(core) || YEAR_RANGE.test(core)) return null;
  const date = ISO_OR_DAY_FIRST_DATE.exec(core);
  if (date && digits.length - date[0].replace(/\D/gu, '').length <= 4) {
    return null;
  }

  if (
    digits.length >= 13 &&
    digits.length <= 19 &&
    passesLuhn(digits) &&
    !/^(\d)\1+$/u.test(digits)
  ) {
    return { length: match.length, category: 'card' };
  }

  const compact = /^\d+$/u.test(core);
  const minimumDigits = match.startsWith('+') ? 7 : compact ? 9 : 8;
  return digits.length >= minimumDigits
    ? { length: match.length, category: 'phone' }
    : null;
}

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

/**
 * Detectors in priority order. A lower-priority match that overlaps an accepted span
 * is dropped, so a URL keeps the email, IP and digits it contains.
 */
const DETECTORS: readonly Detector[] = [
  {
    pattern:
      /(?:(?<![\p{L}\p{N}])(?:https?:\/\/|www\.)|(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.){1,5}\p{L}{2,24}\/)[^\s<>"'`]+/giu,
    classify: classifyUrl,
  },
  {
    pattern:
      /(?<![\p{L}\p{N}._%+\-\uFF0E])[\p{L}\p{N}._%+\-\uFF0E]{1,254}[@\uFF20](?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?[.\uFF0E\u3002\uFF61]){1,8}\p{L}{2,24}/gu,
    classify: whole('email'),
  },
  {
    pattern:
      /(?<![\p{L}\p{N}_@\uFF20.])[@\uFF20][\p{L}_][\p{L}\p{N}_.]{1,28}/gu,
    classify: classifyHandle,
  },
  {
    pattern:
      /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:[ \u00A0\u202F]?[A-Z0-9]){11,30}/gi,
    classify: classifyIban,
  },
  {
    pattern: /(?<![\p{N}-])\d{3}[- \u00A0]\d{2}[- \u00A0]\d{4}(?![\p{N}-])/gu,
    classify: classifySsn,
  },
  {
    pattern:
      /(?<![A-Za-z0-9])[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z](?:[ \u00A0]?\d{2}){3}[ \u00A0]?[A-D](?![A-Za-z0-9])/gi,
    classify: classifyNino,
  },
  {
    pattern: new RegExp(
      `(?<![\\p{N}.])${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}(?!\\p{N}|\\.\\p{N})`,
      'gu',
    ),
    classify: whole('ip'),
  },
  {
    pattern:
      /(?<![\p{L}\p{N}:.])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:\.\d{1,3}){0,3}(?![\p{L}\p{N}:])/giu,
    classify: classifyIpv6,
  },
  {
    pattern:
      /(?<![A-Za-z\p{N}])[+(]?\p{Nd}(?:[ \u00A0\u2000-\u200A\u202F\u3000.()\u2010-\u2015-]{0,3}\p{Nd})*(?![A-Za-z\p{N}])/gu,
    classify: classifyDigitRun,
  },
];

interface Span {
  readonly start: number;
  readonly end: number;
  readonly category: PiiCategory;
}

function findSpans(text: string): Span[] {
  const covered = new Uint8Array(text.length);
  const spans: Span[] = [];

  for (const detector of DETECTORS) {
    for (const match of text.matchAll(detector.pattern)) {
      const accepted = detector.classify(match[0]);
      if (!accepted) continue;

      const start = match.index;
      const end = start + accepted.length;
      if (covered.subarray(start, end).some((flag) => flag === 1)) continue;

      covered.fill(1, start, end);
      spans.push({ start, end, category: accepted.category });
    }
  }

  return spans.sort((a, b) => a.start - b.start);
}

function randomLetters(length: number): string {
  return Array.from(randomBytes(length), (byte) =>
    String.fromCharCode(65 + (byte % 26)),
  ).join('');
}

const EMPTY_SUMMARY: PiiSummary = { total: 0, byCategory: {} };

/**
 * Text that is safe to hand to a third-party provider, plus the means to put the
 * original values back. Raw values live in private fields so logging or serialising
 * the object can never disclose them.
 */
export class ProtectedText {
  /** The text to send: every sensitive span is an opaque redaction token. */
  readonly text: string;
  readonly summary: PiiSummary;
  readonly outcome: Exclude<PiiScrubOutcome, 'placeholder_mismatch'>;
  /**
   * Non-sensitive pieces that contain content, in order. Script conversion sends
   * these instead of placeholders, because a script converter would rewrite them.
   */
  readonly segments: readonly string[];

  readonly #pieces: readonly Piece[];
  readonly #values: readonly string[];
  readonly #placeholderPrefix: RegExp;
  readonly #placeholderPattern: RegExp;

  constructor(source: string) {
    const spans = findSpans(source);
    const nonce = randomLetters(8);
    const pieces: Piece[] = [];
    const values: string[] = [];
    const byCategory: Partial<Record<PiiCategory, number>> = {};
    let text = '';
    let cursor = 0;

    for (const span of spans) {
      if (span.start > cursor) {
        const plain = source.slice(cursor, span.start);
        pieces.push({ pii: false, value: plain });
        text += plain;
      }
      const value = source.slice(span.start, span.end);
      pieces.push({ pii: true, value });
      text += `PII${nonce}${values.length}Z`;
      values.push(value);
      byCategory[span.category] = (byCategory[span.category] ?? 0) + 1;
      cursor = span.end;
    }
    if (cursor < source.length || pieces.length === 0) {
      const plain = source.slice(cursor);
      pieces.push({ pii: false, value: plain });
      text += plain;
    }

    this.text = text;
    this.summary =
      values.length === 0
        ? EMPTY_SUMMARY
        : { total: values.length, byCategory };
    this.segments = pieces
      .filter((piece) => !piece.pii && HAS_CONTENT.test(piece.value))
      .map((piece) => piece.value);
    this.outcome =
      values.length === 0
        ? 'clean'
        : pieces.some((piece) => !piece.pii && HAS_LETTER.test(piece.value))
          ? 'redacted'
          : 'skipped';

    this.#pieces = pieces;
    this.#values = values;
    this.#placeholderPrefix = new RegExp(`PII${nonce}`, 'iu');
    this.#placeholderPattern = new RegExp(`PII${nonce}(\\p{Nd}+)Z`, 'giu');
  }

  /** True when only sensitive spans remain, so a provider call could translate nothing. */
  get nothingToTranslate(): boolean {
    return this.outcome === 'skipped';
  }

  /** Safe under accidental string interpolation: never includes a value. */
  toString(): string {
    return `ProtectedText(redactions=${this.summary.total})`;
  }

  /**
   * Puts the original values back into text the provider produced from `this.text`.
   * Returns `null` when a redaction token is missing, unknown or damaged, so the caller
   * can treat the response as invalid rather than show incomplete data.
   */
  restore(providerText: string): string | null {
    if (this.#values.length === 0) return providerText;

    const seen = new Set<number>();
    let unknownPlaceholder = false;
    const restored = providerText.replace(
      this.#placeholderPattern,
      (_placeholder: string, rawIndex: string) => {
        const index = Number(onlyDigits(rawIndex));
        const value = this.#values[index];
        if (value === undefined) {
          unknownPlaceholder = true;
          return '';
        }
        seen.add(index);
        return value;
      },
    );

    if (
      unknownPlaceholder ||
      seen.size !== this.#values.length ||
      this.#placeholderPrefix.test(restored)
    ) {
      return null;
    }
    return restored;
  }

  /**
   * Rebuilds the text from provider output for each entry of `segments`, keeping
   * sensitive spans and whitespace-only pieces exactly as written. Returns `null`
   * when the provider did not return one result per segment.
   */
  rebuild(processedSegments: readonly string[]): string | null {
    if (processedSegments.length !== this.segments.length) return null;

    let next = 0;
    return this.#pieces
      .map((piece) =>
        piece.pii || !HAS_CONTENT.test(piece.value)
          ? piece.value
          : processedSegments[next++],
      )
      .join('');
  }
}

/** Masks every sensitive span in `text` and returns the protected form. */
export function protectText(text: string): ProtectedText {
  return new ProtectedText(text);
}

/** `email:1,phone:2`: category counts only, never a value. */
export function describePiiSummary(summary: PiiSummary): string {
  return Object.entries(summary.byCategory)
    .map(([category, count]) => `${category}:${count}`)
    .join(',');
}

/** Metric sink implemented by `MetricsService`. */
export interface PiiMetrics {
  recordPiiScrub(
    provider: PiiProvider,
    operation: PiiOperation,
    outcome: PiiScrubOutcome,
  ): void;
  recordPiiRedactions(
    provider: PiiProvider,
    operation: PiiOperation,
    category: PiiCategory,
    count: number,
  ): void;
}

/** Where scrub diagnostics go. Messages never contain text, values or user data. */
export interface PiiTelemetry {
  debug(message: string): void;
  warn(message: string): void;
  readonly metrics?: PiiMetrics;
}

export interface PiiScrubContext {
  readonly provider: PiiProvider;
  readonly operation: PiiOperation;
}

/** Masks `text` for a provider call and records value-free diagnostics. */
export function protectForProvider(
  text: string,
  context: PiiScrubContext,
  telemetry: PiiTelemetry,
): ProtectedText {
  const protectedText = protectText(text);
  const { provider, operation } = context;

  telemetry.metrics?.recordPiiScrub(provider, operation, protectedText.outcome);
  if (protectedText.summary.total > 0) {
    telemetry.debug(
      `pii_scrubbed provider=${provider} operation=${operation} outcome=${protectedText.outcome} redactions=${protectedText.summary.total} categories=${describePiiSummary(protectedText.summary)}`,
    );
    for (const category of PII_CATEGORIES) {
      const count = protectedText.summary.byCategory[category];
      if (count) {
        telemetry.metrics?.recordPiiRedactions(
          provider,
          operation,
          category,
          count,
        );
      }
    }
  }
  return protectedText;
}

/**
 * Restores provider output and reports a mismatch. A `null` result means the response
 * must be treated as invalid: the provider altered a redaction token.
 */
export function restoreFromProvider(
  protectedText: ProtectedText,
  providerText: string,
  context: PiiScrubContext,
  telemetry: PiiTelemetry,
): string | null {
  const restored = protectedText.restore(providerText);
  if (restored === null) {
    telemetry.metrics?.recordPiiScrub(
      context.provider,
      context.operation,
      'placeholder_mismatch',
    );
    telemetry.warn(
      `pii_placeholder_mismatch provider=${context.provider} operation=${context.operation} redactions=${protectedText.summary.total}`,
    );
  }
  return restored;
}
