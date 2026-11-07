#!/usr/bin/env node
/**
 * Whole-tree audit for hardcoded user-facing strings in Angular templates.
 *
 * `verify-translation-safe-component-apis.mjs` only inspects lines added in a diff, so strings that
 * landed before it existed (or through paths it does not scan) are never revisited. This verifier
 * walks every non-test template (`.html` files and inline `template:` literals) and fails when
 * visible copy or assistive copy bypasses the translation layer.
 *
 * Intentionally untranslated static copy (a brand wordmark, a code sample) must carry the
 * `translation-static-ok` marker on the same line as the copy or on the line directly above it,
 * matching the escape used by `verify-translation-safe-component-apis.mjs`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '..');

export const DEFAULT_ROOTS = [resolve(repositoryRoot, 'frontend/src/app')];
export const ESCAPE_MARKER = 'translation-static-ok';

const SOURCE_EXTENSIONS = new Set(['.html', '.ts']);
const TEST_FILE_PATTERN = /\.(?:spec|test|stories|e2e-spec)\.ts$/;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'generated', 'testing']);

/** Attributes that carry copy on every element, including native ones. */
const NATIVE_COPY_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'title',
  'alt',
]);

/** Inputs that carry copy on component elements (tag names containing a hyphen). */
const COMPONENT_COPY_ATTRIBUTES = new Set([
  ...NATIVE_COPY_ATTRIBUTES,
  'arialabel',
  'ariadescription',
  'label',
  'heading',
  'subtitle',
  'description',
  'caption',
  'hint',
  'helpertext',
  'errortext',
  'tooltip',
  'emptytitle',
  'emptymessage',
  'actionlabel',
  'buttonlabel',
  'confirmlabel',
  'cancellabel',
  'submitlabel',
  'closelabel',
  'retrylabel',
  'legend',
  'helptext',
]);

const CONTROL_FLOW_KEYWORDS = [
  'else if',
  'else',
  'if',
  'for',
  'switch',
  'case',
  'default',
  'empty',
  'defer',
  'placeholder',
  'loading',
  'error',
];

const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < source.length; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

/** Emoji and pictographs (including letter-like symbols such as U+2139) are glyphs, not words. */
const PICTOGRAPHS = /[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu;

/** Example values that carry no translatable wording: hex colours, URLs and email addresses. */
const NON_COPY_VALUE = /^(?:#[\da-f]{3,8}|https?:\/\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)$/i;

function hasLetter(value) {
  return /\p{L}/u.test(value.replace(PICTOGRAPHS, ''));
}

function stripEntities(value) {
  return value.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, ' ');
}

/** Returns the index just past the quoted string starting at `start`, honouring backslash escapes. */
function skipQuoted(source, start) {
  const quote = source[start];
  let cursor = start + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return source.length;
}

/** Returns the index just past the balanced `(...)` group starting at `start`. */
function skipBalancedParentheses(source, start) {
  let depth = 0;
  let cursor = start;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === '`') {
      cursor = skipQuoted(source, cursor);
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
    cursor += 1;
  }
  return source.length;
}

function matchControlFlowKeyword(source, index) {
  for (const keyword of CONTROL_FLOW_KEYWORDS) {
    const candidate = source.slice(index + 1, index + 1 + keyword.length);
    if (candidate !== keyword) continue;
    const following = source[index + 1 + keyword.length] ?? '';
    if (/[\w-]/.test(following)) continue;
    return keyword;
  }
  return null;
}

/** Skips an `@if (...) {` style block header and returns the index after the opening brace. */
function skipControlFlowHeader(source, index, keyword) {
  let cursor = index + 1 + keyword.length;
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] === '(') cursor = skipBalancedParentheses(source, cursor);
  while (/\s/.test(source[cursor] ?? '')) cursor += 1;
  if (source[cursor] === '{') cursor += 1;
  return cursor;
}

function skipLetDeclaration(source, index) {
  let cursor = index + 4;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "'" || character === '"' || character === '`') {
      cursor = skipQuoted(source, cursor);
      continue;
    }
    cursor += 1;
    if (character === ';') break;
  }
  return cursor;
}

function parseTag(source, start) {
  const nameMatch = /^[A-Za-z][\w:.-]*/.exec(source.slice(start + 1, start + 128));
  const name = nameMatch[0];
  let cursor = start + 1 + name.length;
  const attributes = [];

  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    const character = source[cursor];
    if (character === undefined) break;
    if (character === '>') return { name, attributes, end: cursor + 1 };
    if (character === '/' && source[cursor + 1] === '>')
      return { name, attributes, end: cursor + 2 };
    if (character === '/') {
      cursor += 1;
      continue;
    }

    const attributeStart = cursor;
    while (cursor < source.length && !/[\s=>/]/.test(source[cursor])) {
      if (source[cursor] === '[' || source[cursor] === '(') {
        // Angular binding names may contain brackets; read through the matching closer.
        const closer = source[cursor] === '[' ? ']' : ')';
        const closerIndex = source.indexOf(closer, cursor);
        cursor = closerIndex === -1 ? source.length : closerIndex + 1;
        continue;
      }
      cursor += 1;
    }
    const attributeName = source.slice(attributeStart, cursor);
    let value = null;
    let valueStart = cursor;

    let lookahead = cursor;
    while (/\s/.test(source[lookahead] ?? '')) lookahead += 1;
    if (source[lookahead] === '=') {
      lookahead += 1;
      while (/\s/.test(source[lookahead] ?? '')) lookahead += 1;
      const quote = source[lookahead];
      if (quote === '"' || quote === "'") {
        const close = source.indexOf(quote, lookahead + 1);
        const valueEnd = close === -1 ? source.length : close;
        value = source.slice(lookahead + 1, valueEnd);
        valueStart = lookahead + 1;
        cursor = close === -1 ? source.length : close + 1;
      } else {
        const unquotedStart = lookahead;
        while (lookahead < source.length && !/[\s>]/.test(source[lookahead])) lookahead += 1;
        value = source.slice(unquotedStart, lookahead);
        valueStart = unquotedStart;
        cursor = lookahead;
      }
    }

    if (attributeName)
      attributes.push({ name: attributeName, value, index: attributeStart, valueStart });
    if (cursor === attributeStart) cursor += 1;
  }

  return { name, attributes, end: source.length };
}

/**
 * Splits a template into element tags, visible text segments and interpolations. Text inside
 * comments, `<script>`, `<style>`, Angular control-flow headers and `@let` declarations is ignored.
 */
export function tokenizeTemplate(source) {
  const elements = [];
  const texts = [];
  const interpolations = [];
  let cursor = 0;
  let buffer = '';
  let bufferStart = -1;

  function flush() {
    if (buffer.trim()) texts.push({ text: buffer, index: bufferStart });
    buffer = '';
    bufferStart = -1;
  }

  while (cursor < source.length) {
    const character = source[cursor];

    if (source.startsWith('<!--', cursor)) {
      flush();
      const close = source.indexOf('-->', cursor + 4);
      cursor = close === -1 ? source.length : close + 3;
      continue;
    }

    if (character === '<' && /[A-Za-z]/.test(source[cursor + 1] ?? '')) {
      flush();
      const tag = parseTag(source, cursor);
      elements.push({ ...tag, index: cursor });
      cursor = tag.end;
      if (RAW_TEXT_ELEMENTS.has(tag.name.toLowerCase())) {
        const closeTag = new RegExp(`</${tag.name}\\s*>`, 'i').exec(source.slice(cursor));
        cursor = closeTag ? cursor + closeTag.index + closeTag[0].length : source.length;
      }
      continue;
    }

    if (character === '<' && source[cursor + 1] === '/') {
      flush();
      const close = source.indexOf('>', cursor);
      cursor = close === -1 ? source.length : close + 1;
      continue;
    }

    if (character === '{' && source[cursor + 1] === '{') {
      flush();
      const close = source.indexOf('}}', cursor + 2);
      const end = close === -1 ? source.length : close;
      interpolations.push({ expression: source.slice(cursor + 2, end), index: cursor });
      cursor = close === -1 ? source.length : close + 2;
      continue;
    }

    if (character === '@') {
      if (source.startsWith('@let', cursor) && /\s/.test(source[cursor + 4] ?? '')) {
        flush();
        cursor = skipLetDeclaration(source, cursor);
        continue;
      }
      const keyword = matchControlFlowKeyword(source, cursor);
      if (keyword) {
        flush();
        cursor = skipControlFlowHeader(source, cursor, keyword);
        continue;
      }
    }

    if (character === '}') {
      flush();
      cursor += 1;
      continue;
    }

    if (bufferStart === -1) bufferStart = cursor;
    buffer += character;
    cursor += 1;
  }
  flush();

  return { elements, texts, interpolations };
}

/** Splits `a ? b : c` at its top-level operators, ignoring operators inside quotes or brackets. */
function splitTernary(expression) {
  let depth = 0;
  let questionIndex = -1;
  let colonIndex = -1;
  let cursor = 0;
  while (cursor < expression.length) {
    const character = expression[cursor];
    if (character === "'" || character === '"' || character === '`') {
      cursor = skipQuoted(expression, cursor);
      continue;
    }
    if ('([{'.includes(character)) depth += 1;
    if (')]}'.includes(character)) depth -= 1;
    if (
      depth === 0 &&
      character === '?' &&
      expression[cursor + 1] !== '?' &&
      expression[cursor + 1] !== '.'
    ) {
      if (questionIndex === -1) questionIndex = cursor;
    } else if (depth === 0 && character === ':' && questionIndex !== -1 && colonIndex === -1) {
      colonIndex = cursor;
    }
    cursor += 1;
  }
  if (questionIndex === -1 || colonIndex === -1) return null;
  return [expression.slice(questionIndex + 1, colonIndex), expression.slice(colonIndex + 1)];
}

function hasTopLevelPipe(expression) {
  let depth = 0;
  let cursor = 0;
  while (cursor < expression.length) {
    const character = expression[cursor];
    if (character === "'" || character === '"' || character === '`') {
      cursor = skipQuoted(expression, cursor);
      continue;
    }
    if ('([{'.includes(character)) depth += 1;
    if (')]}'.includes(character)) depth -= 1;
    if (character === '|' && expression[cursor + 1] !== '|' && expression[cursor - 1] !== '|')
      return true;
    cursor += 1;
  }
  return false;
}

const SIMPLE_ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };

/** Decodes JavaScript string escapes so glyph escapes such as `\u23F8` are not mistaken for words. */
export function decodeStringEscapes(value) {
  return value.replace(
    /\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|([\s\S]))/g,
    (_match, codePoint, unit, hex, simple) => {
      const numeric = codePoint ?? unit ?? hex;
      if (numeric !== undefined) {
        const parsed = Number.parseInt(numeric, 16);
        return parsed > 0x10ffff ? '' : String.fromCodePoint(parsed);
      }
      return SIMPLE_ESCAPES[simple] ?? simple;
    },
  );
}

/**
 * Returns the literal strings an expression resolves to directly, for example `'Close'` or both
 * branches of `isOpen ? 'Hide' : 'Show'`. Literals that flow through a pipe (`'key' | t`) are
 * translation keys and are not returned.
 */
export function bareCopyLiterals(expression) {
  const trimmed = expression.trim();
  if (!trimmed || hasTopLevelPipe(trimmed)) return [];

  const ternary = splitTernary(trimmed);
  if (ternary) return ternary.flatMap((branch) => bareCopyLiterals(branch));

  const wrapped = /^\((.*)\)$/s.exec(trimmed);
  if (wrapped) return bareCopyLiterals(wrapped[1]);

  const literal = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/s.exec(trimmed);
  if (!literal) return [];
  if (literal[1] === '`' && literal[2].includes('${')) return [];
  const decoded = decodeStringEscapes(literal[2]);
  return hasLetter(decoded) && !NON_COPY_VALUE.test(decoded.trim()) ? [decoded] : [];
}

/** True when the expression resolves directly to literal copy containing letters. */
export function isBareCopyLiteral(expression) {
  return bareCopyLiterals(expression).length > 0;
}

/** Dotted identifiers such as `deck.nameLabel` are translation keys, not copy. */
const TRANSLATION_KEY_SHAPE = /^[A-Za-z][\w-]*(?:\.[\w-]+)+$/;

function normaliseAttributeName(name) {
  return name
    .replace(/^\[(?:attr\.)?/, '')
    .replace(/\]$/, '')
    .toLowerCase();
}

function isBindingName(name) {
  return name.startsWith('[') || name.startsWith('bind-');
}

function isStructuralOrEventName(name) {
  return (
    name.startsWith('(') || name.startsWith('*') || name.startsWith('#') || name.startsWith('@')
  );
}

function copyAttributesFor(tagName) {
  return tagName.includes('-') ? COMPONENT_COPY_ATTRIBUTES : NATIVE_COPY_ATTRIBUTES;
}

const STANDALONE_COMMENT = /^(?:<!--.*-->|\/\/.*|\/\*.*\*\/)$/;

function isEscaped(source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  let lineEnd = source.indexOf('\n', index);
  if (lineEnd === -1) lineEnd = source.length;
  if (source.slice(lineStart, lineEnd).includes(ESCAPE_MARKER)) return true;

  // A marker on the line above only counts when that line is a standalone comment, so an inline
  // marker on one element never silently excuses the element below it.
  if (lineStart === 0) return false;
  const previousStart = source.lastIndexOf('\n', lineStart - 2) + 1;
  const previousLine = source.slice(previousStart, lineStart).trim();
  return STANDALONE_COMMENT.test(previousLine) && previousLine.includes(ESCAPE_MARKER);
}

function makeViolation({ code, detail, file, line }) {
  return { code, detail, file, line, fingerprint: `${file}:${code}:${detail}` };
}

function previewText(value) {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > 80 ? `${collapsed.slice(0, 77)}...` : collapsed;
}

export function scanTemplate(source, file = '(template)', lineOffset = 0) {
  const violations = [];
  const { elements, texts, interpolations } = tokenizeTemplate(source);
  const lineOf = (index) => lineOffset + lineNumberAt(source, index);

  for (const element of elements) {
    const copyAttributes = copyAttributesFor(element.name);
    const isComponent = element.name.includes('-');
    const elementEscaped = isEscaped(source, element.index);

    for (const attribute of element.attributes) {
      if (attribute.value === null || isStructuralOrEventName(attribute.name)) continue;
      const normalised = normaliseAttributeName(attribute.name);
      if (!copyAttributes.has(normalised)) continue;
      if (elementEscaped || isEscaped(source, attribute.index)) continue;

      if (isBindingName(attribute.name)) {
        const literals = bareCopyLiterals(attribute.value);
        const copy = isComponent
          ? literals.filter((literal) => !TRANSLATION_KEY_SHAPE.test(literal.trim()))
          : literals;
        if (copy.length === 0) continue;
        violations.push(
          makeViolation({
            code: 'literal-copy-binding',
            detail: `${attribute.name}=${previewText(attribute.value)}`,
            file,
            line: lineOf(attribute.index),
          }),
        );
        continue;
      }

      if (attribute.value.includes('{{')) {
        const residue = attribute.value.replace(/\{\{[\s\S]*?\}\}/g, ' ');
        if (!hasLetter(stripEntities(residue))) continue;
      }
      if (!hasLetter(stripEntities(attribute.value))) continue;
      if (NON_COPY_VALUE.test(attribute.value.trim())) continue;
      // Design-system primitives such as app-input translate dotted keys passed as static inputs.
      if (isComponent && TRANSLATION_KEY_SHAPE.test(attribute.value.trim())) continue;
      violations.push(
        makeViolation({
          code: 'static-copy-attribute',
          detail: `${attribute.name}="${previewText(attribute.value)}"`,
          file,
          line: lineOf(attribute.index),
        }),
      );
    }
  }

  for (const text of texts) {
    const visible = stripEntities(text.text);
    if (!hasLetter(visible)) continue;
    const firstLetter = text.text.search(/\p{L}/u);
    const letterIndex = text.index + Math.max(firstLetter, 0);
    if (isEscaped(source, letterIndex)) continue;
    violations.push(
      makeViolation({
        code: 'static-text-node',
        detail: previewText(visible),
        file,
        line: lineOf(letterIndex),
      }),
    );
  }

  for (const interpolation of interpolations) {
    if (!isBareCopyLiteral(interpolation.expression)) continue;
    if (isEscaped(source, interpolation.index)) continue;
    violations.push(
      makeViolation({
        code: 'literal-copy-interpolation',
        detail: `{{${previewText(interpolation.expression)}}}`,
        file,
        line: lineOf(interpolation.index),
      }),
    );
  }

  return violations.sort((left, right) => left.line - right.line);
}

/** Extracts the body and starting line of every inline `template:` literal in a TypeScript source. */
export function extractInlineTemplates(source) {
  const templates = [];
  const pattern = /\btemplate\s*:\s*(['"`])/g;
  for (const match of source.matchAll(pattern)) {
    const quote = match[1];
    const bodyStart = (match.index ?? 0) + match[0].length;
    let cursor = bodyStart;
    while (cursor < source.length) {
      if (source[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (source[cursor] === quote) break;
      cursor += 1;
    }
    templates.push({
      body: source.slice(bodyStart, cursor),
      lineOffset: lineNumberAt(source, bodyStart) - 1,
    });
  }
  return templates;
}

const NATIVE_DIALOG_CALL =
  /(?<![\w.$])(?:window\.)?(alert|confirm|prompt)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

/** Strips `${...}` placeholders and escapes so only the literal wording is left to inspect. */
function literalWording(rawLiteral) {
  return decodeStringEscapes(rawLiteral.replace(/\$\{[^}]*\}/g, ' '));
}

/** Flags `alert('...')` style calls whose message is a literal instead of a translated value. */
export function scanNativeDialogLiterals(source, file = '(source)') {
  const violations = [];
  for (const match of source.matchAll(NATIVE_DIALOG_CALL)) {
    if (!hasLetter(literalWording(match[3]))) continue;
    if (isEscaped(source, match.index ?? 0)) continue;
    violations.push(
      makeViolation({
        code: 'native-dialog-literal',
        detail: `${match[1]}(${previewText(match[3])})`,
        file,
        line: lineNumberAt(source, match.index ?? 0),
      }),
    );
  }
  return violations;
}

/**
 * Signals and fields that hold feedback shown to the user (`errorMessage`, `successMessage`,
 * `notice`, `hint`...) must be set from translated values. Only sentence-like literals of two or
 * more words are flagged so state tokens such as `'idle'` stay out of scope.
 */
const MESSAGE_NAME = '[\\w$]*(?:error|message|notice|feedback|warning|hint|toast)[\\w$]*';
const MESSAGE_SETTER = new RegExp(
  `\\b(${MESSAGE_NAME})\\.set\\(\\s*(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2\\s*\\)`,
  'gi',
);
const MESSAGE_ASSIGNMENT = new RegExp(
  `\\bthis\\.(${MESSAGE_NAME})\\s*=\\s*(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2\\s*;`,
  'gi',
);

export function scanMessageLiterals(source, file = '(source)') {
  const violations = [];
  for (const pattern of [MESSAGE_SETTER, MESSAGE_ASSIGNMENT]) {
    for (const match of source.matchAll(pattern)) {
      if (!/\p{L}+\s+\p{L}+/u.test(literalWording(match[3]))) continue;
      if (isEscaped(source, match.index ?? 0)) continue;
      violations.push(
        makeViolation({
          code: 'literal-message-state',
          detail: `${match[1]} <- ${previewText(match[3])}`,
          file,
          line: lineNumberAt(source, match.index ?? 0),
        }),
      );
    }
  }
  return violations;
}

export function scanSourceFile(source, file) {
  if (file.endsWith('.html')) return scanTemplate(source, file);

  const violations = [
    ...scanNativeDialogLiterals(source, file),
    ...scanMessageLiterals(source, file),
  ];
  for (const template of extractInlineTemplates(source)) {
    violations.push(...scanTemplate(template.body, file, template.lineOffset));
  }
  return violations.sort((left, right) => left.line - right.line);
}

export function collectSourceFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      collectSourceFiles(path, files);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    if (TEST_FILE_PATTERN.test(entry.name)) continue;
    files.push(path);
  }
  return files.sort();
}

export function auditRoots(roots = DEFAULT_ROOTS, baseDirectory = repositoryRoot) {
  const violations = [];
  for (const root of roots) {
    for (const path of collectSourceFiles(root)) {
      const file = relative(baseDirectory, path).replaceAll('\\', '/');
      violations.push(...scanSourceFile(readFileSync(path, 'utf8'), file));
    }
  }
  return violations;
}

/** Dictionary keys referenced as `'key' | t` or `.translate('key')` that `I18nService` cannot resolve. */
export function findMissingTranslationKeys(
  roots = DEFAULT_ROOTS,
  dictionaryPath = DICTIONARY_PATH,
  baseDirectory = repositoryRoot,
) {
  const dictionary = readFileSync(dictionaryPath, 'utf8');
  const start = dictionary.indexOf('baseDictionary');
  const defined = new Set();
  for (const match of dictionary.slice(start).matchAll(/^\s{4}'([^']+)':/gm)) defined.add(match[1]);

  const usages = new Map();
  const patterns = [
    /(['"])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1\s*\|\s*t\b/g,
    /\.translate\(\s*(['"`])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1/g,
  ];
  for (const root of roots) {
    for (const path of collectSourceFiles(root)) {
      const source = readFileSync(path, 'utf8');
      const file = relative(baseDirectory, path).replaceAll('\\', '/');
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
          if (defined.has(match[2])) continue;
          const files = usages.get(match[2]) ?? new Set();
          files.add(file);
          usages.set(match[2], files);
        }
      }
    }
  }
  return [...usages.entries()]
    .map(([key, files]) => ({ key, files: [...files].sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export const DICTIONARY_PATH = resolve(repositoryRoot, 'frontend/src/app/services/i18n.service.ts');

function formatViolation(violation) {
  return `- ${violation.file}:${violation.line} [${violation.code}] ${violation.detail}`;
}

function printReport(violations, { includeMissingKeys }) {
  const byCode = {};
  for (const violation of violations) byCode[violation.code] = (byCode[violation.code] ?? 0) + 1;
  console.log(`Hardcoded UI strings: ${violations.length}`);
  for (const [code, count] of Object.entries(byCode).sort()) console.log(`  ${code}: ${count}`);
  for (const violation of violations) console.log(formatViolation(violation));

  if (!includeMissingKeys) return;

  const missing = findMissingTranslationKeys();
  const byPrefix = {};
  for (const { key } of missing) {
    const prefix = key.split('.')[0];
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;
  }
  console.log(
    `\nTranslation keys used but not defined in I18nService.baseDictionary: ${missing.length}`,
  );
  console.log('These render as the raw key. Informational only: the gate does not fail on them.');
  for (const [prefix, count] of Object.entries(byPrefix).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )) {
    console.log(`  ${prefix}: ${count}`);
  }
}

function main(argv) {
  // `--root=<directory>` audits another Angular source tree, for example admin-portal/src/app.
  const customRoots = argv
    .filter((argument) => argument.startsWith('--root='))
    .map((argument) => resolve(argument.slice('--root='.length)));
  const violations = auditRoots(customRoots.length > 0 ? customRoots : DEFAULT_ROOTS);

  if (argv.includes('--report')) {
    printReport(violations, { includeMissingKeys: customRoots.length === 0 });
    return;
  }

  if (violations.length === 0) {
    console.log(
      'No hardcoded UI strings found in frontend templates, native dialogs or message state.',
    );
    return;
  }

  console.error(`Found ${violations.length} hardcoded UI string(s):`);
  for (const violation of violations) console.error(formatViolation(violation));
  console.error(
    `Route copy through TranslatePipe (| t) or I18nService, or mark intentionally untranslated static copy with ${ESCAPE_MARKER}.`,
  );
  process.exit(1);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2));
}
