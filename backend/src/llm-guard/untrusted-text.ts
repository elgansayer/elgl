/**
 * Text-level primitives for treating user content as data when it is sent to,
 * or received from, a language model.
 *
 * Everything here is a pure function: no I/O, no logging and no state. The
 * prompt builders and the shared LLM clients compose these primitives; see
 * docs/llm-prompt-injection-protection.md for the threat model.
 *
 * Invisible characters are written as code point escapes (the braced form)
 * on purpose: a raw invisible character in this file would be indistinguishable
 * from the attack it defends against.
 */

/**
 * Categories of suspicious content. Only the category is ever logged or
 * counted, never the matched text, because the text is private user content.
 */
export type InjectionSignal =
  | 'instruction_override'
  | 'role_reassignment'
  | 'prompt_exfiltration'
  | 'template_token'
  | 'role_marker'
  | 'delimiter_spoof'
  | 'hidden_tag_characters';

/**
 * Signals strong enough to withhold third-party text from a prompt. The
 * remaining signals (role markers and delimiter look-alikes) are already made
 * harmless by JSON encoding, so they are telemetry only.
 */
export const QUARANTINE_SIGNALS: ReadonlySet<InjectionSignal> = new Set([
  'instruction_override',
  'role_reassignment',
  'prompt_exfiltration',
  'template_token',
  'hidden_tag_characters',
]);

/** JSON-compatible value whose strings are untrusted. */
export type UntrustedJson =
  | string
  | number
  | boolean
  | null
  | readonly UntrustedJson[]
  | { readonly [key: string]: UntrustedJson | undefined };

/**
 * Characters that are invisible or that can reorder text: C0 and C1 controls
 * (tab and newline are kept), soft hyphen, the Mongolian vowel separator,
 * zero-width space, word joiner and the invisible operators, bidirectional
 * embeddings, overrides and isolates, the byte order mark, and the Unicode tag
 * and variation selector supplement blocks that are used to smuggle invisible
 * instructions.
 *
 * Zero-width joiners, non-joiners and the left-to-right and right-to-left
 * marks are deliberately kept: Persian, Arabic and Indic scripts, and emoji
 * sequences, depend on them.
 */
const CONTROL_AND_HIDDEN =
  // eslint-disable-next-line no-control-regex, no-misleading-character-class -- these invisible code points are the input being removed
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u{AD}\u{180E}\u{200B}\u{2060}-\u{2064}\u{2066}-\u{206F}\u{202A}-\u{202E}\u{FEFF}\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

const TAG_CHARACTERS = /[\u{E0000}-\u{E007F}]/u;

const LINE_BREAKS = /\r\n?|[\u{2028}\u{2029}]/gu;

/** In Unicode mode only an unpaired surrogate has the category Cs. */
const LONE_SURROGATE = /\p{Cs}/gu;
const TRAILING_LONE_SURROGATE = /\p{Cs}$/u;
const REPLACEMENT_CHARACTER = '\u{FFFD}';

/**
 * Control tokens that some model families parse out of message content as turn
 * boundaries: ChatML and Llama 3 (`<|...|>`), Llama 2 and Mistral (`[INST]`,
 * `<<SYS>>`, `<s>`), Gemma (`<start_of_turn>`) and bare role tags.
 */
const TEMPLATE_TOKEN =
  /<\|[^|<>\n]{1,40}\|>|\[\/?INST\]|<<\/?SYS>>|<\/?s>|<\/?(?:start_of_turn|end_of_turn|bos|eos|pad)>|<\/?\|?(?:system|user|assistant)\|?>/gi;

export interface SanitisedText {
  text: string;
  /** Hidden or control characters that were removed. */
  removed: number;
  /** Model control tokens that were defused. */
  neutralised: number;
  /** True when the text exceeded the limit and was cut. */
  truncated: boolean;
}

/**
 * Normalises untrusted text for a prompt: unifies line endings, removes hidden
 * and control characters, defuses model control tokens and applies a length
 * limit. The result is still the user's text, only without the characters that
 * exist to deceive a model or a reviewer.
 */
export function sanitiseUntrustedText(
  value: string,
  maxLength: number,
): SanitisedText {
  let removed = 0;
  let neutralised = 0;

  let text = value
    .replace(LINE_BREAKS, '\n')
    .replace(LONE_SURROGATE, REPLACEMENT_CHARACTER)
    .replace(CONTROL_AND_HIDDEN, () => {
      removed += 1;
      return '';
    })
    .replace(TEMPLATE_TOKEN, (token) => {
      neutralised += 1;
      return `${token[0]} ${token.slice(1)}`;
    });

  let truncated = false;
  if (text.length > maxLength) {
    truncated = true;
    text = text.slice(0, maxLength);
    // Never leave half of a surrogate pair at the cut.
    if (TRAILING_LONE_SURROGATE.test(text)) text = text.slice(0, -1);
  }

  return { text, removed, neutralised, truncated };
}

/**
 * Detection works on a skeleton of the text so that trivial evasions do not
 * work: compatibility forms (full-width letters) are folded by NFKC, and every
 * invisible character is dropped so a keyword split by a zero-width space
 * still reads as the keyword.
 */
function toSkeleton(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{Cf}\p{Cc}]/gu, (character) =>
      character === '\n' || character === '\t' ? character : '',
    )
    .replace(/[ \t]+/g, ' ');
}

const INSTRUCTION_OBJECT =
  'instructions?|prompts?|rules?|directions?|directives?|guidelines?|constraints?|restrictions?|programming|polic(?:y|ies)|context';

/**
 * Heuristic patterns. They are deliberately bounded (no unbounded gaps and no
 * nested quantifiers) so they run in linear time on adversarial input. They
 * are a tripwire and a source of telemetry, not the security boundary: the
 * boundary is structural (see prompt-guard.ts).
 */
const SIGNAL_PATTERNS: ReadonlyArray<readonly [InjectionSignal, RegExp]> = [
  [
    'instruction_override',
    new RegExp(
      `\\b(?:ignore|disregard|forget|override|bypass|discard|skip)\\b[^\\n.]{0,30}\\b(?:all|any|every|the|your|my|these|those|previous|prior|above|earlier|preceding|former|original|system)\\b[^\\n.]{0,30}\\b(?:${INSTRUCTION_OBJECT})\\b`,
      'i',
    ),
  ],
  [
    'instruction_override',
    /\b(?:do\s+not|don'?t|never|stop)\s+(?:follow|obey|listen\s+to)\b[^\n.]{0,30}\b(?:instructions?|rules?|guidelines?|system)\b/i,
  ],
  // Spanish
  [
    'instruction_override',
    /\bignor(?:a|ar|e|en)\b[^\n.]{0,30}\b(?:instrucciones|indicaciones|reglas|directrices)\b/i,
  ],
  // French
  [
    'instruction_override',
    /\bignor(?:e|er|ez)\b[^\n.]{0,30}\b(?:instructions|consignes|règles|regles|directives)\b/i,
  ],
  // German
  [
    'instruction_override',
    /\b(?:ignorier(?:e|en|t)?|vergiss|missachte)\b[^\n.]{0,30}\b(?:anweisungen|instruktionen|regeln|vorgaben|richtlinien)\b/i,
  ],
  // Portuguese
  [
    'instruction_override',
    /\b(?:ignor(?:e|ar|a)|esque[cç]a)\b[^\n.]{0,30}\b(?:instru[cç][õo]es|regras|diretrizes)\b/i,
  ],
  // Italian
  [
    'instruction_override',
    /\b(?:ignora|ignorare|dimentica)\b[^\n.]{0,30}\b(?:istruzioni|regole|direttive)\b/i,
  ],
  // Russian
  [
    'instruction_override',
    /(?:игнорируй(?:те)?|забудь(?:те)?)[^\n.]{0,30}(?:инструкци|указани|правил)/i,
  ],
  // Chinese (simplified and traditional)
  [
    'instruction_override',
    /(?:忽略|忽視|无视|無視|忘记|忘記)[^\n。]{0,10}(?:指令|指示|规则|規則|提示|说明|說明)/,
  ],
  // Japanese
  [
    'instruction_override',
    /(?:指示|命令|ルール|プロンプト)[^\n。]{0,10}(?:無視|忘れ|従わな)/,
  ],
  // Korean
  ['instruction_override', /(?:지시|명령|지침|규칙)[^\n.]{0,10}(?:무시|잊)/],
  // Arabic
  [
    'instruction_override',
    /(?:تجاهل|انس)[^\n.]{0,30}(?:التعليمات|الأوامر|القواعد)/,
  ],
  [
    'role_reassignment',
    /\b(?:you\s+are\s+now\b|from\s+now\s+on,?\s+you\b|new\s+(?:system\s+)?(?:instructions?|persona|role)\s*[:-])/i,
  ],
  [
    'role_reassignment',
    /\b(?:act|behave|respond|reply)\s+as\s+(?:if\s+you\s+(?:are|were)|an?\s+(?:unrestricted|unfiltered|uncensored|jailbroken|different|evil))\b/i,
  ],
  [
    'role_reassignment',
    /\b(?:pretend|imagine)\s+(?:to\s+be|that\s+you(?:'re|\s+are)|you\s+are)\b/i,
  ],
  [
    'role_reassignment',
    /\b(?:developer|debug|god|jailbreak|dan|sudo)\s+mode\b|\bdo\s+anything\s+now\b/i,
  ],
  [
    'prompt_exfiltration',
    /\b(?:reveal|show|print|repeat|display|output|leak|expose|disclose|recite|tell\s+me)\b[^\n.]{0,60}\b(?:system|hidden|initial|original|secret|internal)\s+(?:prompt|instructions?|message|rules)\b/i,
  ],
  [
    'prompt_exfiltration',
    /\bwhat\s+(?:is|are|were)\s+your\s+(?:system\s+|initial\s+|original\s+)?(?:prompt|instructions|rules)\b/i,
  ],
  [
    'prompt_exfiltration',
    /\b(?:reveal|show|print|leak|send|output|dump)\b[^\n.]{0,40}\b(?:api[\s_-]?keys?|secret\s+keys?|access\s+tokens?|credentials?|environment\s+variables?|service[\s_-]?role)\b/i,
  ],
  // Indentation is bounded to the same line: an unbounded \s* would let a run
  // of newlines make the match quadratic.
  [
    'role_marker',
    /(?:^|\n)[ \t]{0,20}(?:system|assistant|developer|tool|human)[ \t]{0,5}[:：]/i,
  ],
  [
    'role_marker',
    /(?:^|\n)[ \t]{0,20}#{2,6}[ \t]{0,5}(?:system|instruction|response|assistant|user)\b/i,
  ],
  [
    'delimiter_spoof',
    /<\/?[ \t]{0,5}(?:system|assistant|user|instructions?|prompt|transcript|conversation|untrusted[\w-]*|data|context)[ \t]{0,5}>/i,
  ],
  [
    'delimiter_spoof',
    /\b(?:begin|end|start)\s+(?:of\s+)?(?:the\s+)?(?:system\s+)?(?:prompt|instructions?|transcript|untrusted\s+data)\b/i,
  ],
];

/**
 * Returns the categories of suspicious content found in raw (unsanitised)
 * text. The result never contains the matched text.
 */
export function detectInjectionSignals(value: string): InjectionSignal[] {
  const signals = new Set<InjectionSignal>();
  if (TAG_CHARACTERS.test(value)) signals.add('hidden_tag_characters');

  const skeleton = toSkeleton(value);
  if (skeleton.search(TEMPLATE_TOKEN) !== -1) signals.add('template_token');
  for (const [signal, pattern] of SIGNAL_PATTERNS) {
    if (!signals.has(signal) && pattern.test(skeleton)) signals.add(signal);
  }
  return [...signals];
}

/** True when any of the signals warrants withholding third-party text. */
export function hasQuarantineSignal(
  signals: readonly InjectionSignal[],
): boolean {
  return signals.some((signal) => QUARANTINE_SIGNALS.has(signal));
}

/**
 * Serialises untrusted data as a single JSON document. JSON string escaping
 * means no value can close a quote, start a new line or forge a delimiter, and
 * angle brackets are escaped so markup-style delimiters cannot be spoofed
 * either. The output is still valid JSON that decodes to the original value.
 */
export function encodeUntrustedData(value: UntrustedJson): string {
  return JSON.stringify(value).replace(
    /[<>\u{2028}\u{2029}]/gu,
    (character) =>
      '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

export interface ScreenedOutput {
  text: string;
  /** True when anything was removed from the model output. */
  changed: boolean;
  /** True when the cleaned text is longer than the allowed length. */
  tooLong: boolean;
}

export interface ScreenOutputOptions {
  maxLength: number;
  /**
   * Untrusted texts the answer is derived from. A link may appear in the
   * answer only when it already appears in one of these, which lets a
   * translation keep the links of its source and nothing else.
   */
  sourceTexts?: readonly string[];
}

const MARKDOWN_LINK =
  /(!?)\[([^\]\n]{0,200})\]\([ \t]{0,5}<?([^)\s>]{1,2000})>?(?:[ \t]{1,5}"[^"\n]{0,200}")?[ \t]{0,5}\)/g;
const BARE_URL = /(?:\b(?:https?|ftp|wss?):\/\/|\bwww\.)[^\s<>"'`]+/gi;
const SCRIPT_URI = /\b(?:javascript|vbscript|data):[^\s<>"'`]+/gi;
const ACTIVE_HTML_TAG =
  /<\/?(?:script|style|iframe|object|embed|img|svg|link|meta|form|input|button|video|audio|source|base|a)\b[^>]{0,500}>/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * Cleans model output before it is stored, pushed or shown to someone. Hidden
 * characters, model control tokens, active HTML and links that did not come
 * from the source text are removed, so an injected instruction cannot turn the
 * model into a phishing or data-exfiltration channel. Length is reported, not
 * enforced by truncation, so a caller can reject an oversized answer instead
 * of showing a cut-off one.
 */
export function screenModelOutput(
  raw: string,
  options: ScreenOutputOptions,
): ScreenedOutput {
  const sources = (options.sourceTexts ?? []).map((source) =>
    source.toLowerCase(),
  );
  const isSourced = (link: string): boolean => {
    const needle = link.replace(TRAILING_PUNCTUATION, '').toLowerCase();
    return (
      needle.length > 0 && sources.some((source) => source.includes(needle))
    );
  };

  const sanitised = sanitiseUntrustedText(raw, Number.MAX_SAFE_INTEGER);
  let changed = sanitised.removed > 0 || sanitised.neutralised > 0;
  const markChanged = (replacement: string): string => {
    changed = true;
    return replacement;
  };

  let text = sanitised.text
    .replace(ACTIVE_HTML_TAG, () => markChanged(''))
    .replace(
      MARKDOWN_LINK,
      (match, _bang: string, label: string, url: string) =>
        isSourced(url) ? match : markChanged(label),
    )
    .replace(SCRIPT_URI, () => markChanged(''))
    .replace(BARE_URL, (match) => (isSourced(match) ? match : markChanged('')));

  if (changed) text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.trim();

  return { text, changed, tooLong: text.length > options.maxLength };
}
