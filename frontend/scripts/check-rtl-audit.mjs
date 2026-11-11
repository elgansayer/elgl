#!/usr/bin/env node

/**
 * Whole-tree right-to-left audit for the Angular frontend.
 *
 * `npm run check:rtl-logical` blocks the classic physical utilities (pl-, ml-, left-, border-l and
 * margin-left style declarations). This gate covers the families that regex cannot see but that
 * still break Arabic and Hebrew layouts:
 *
 * - physical Tailwind families: text-left/right, rounded-l/r/tl/tr/bl/br, float/clear-left/right,
 *   scroll-ml/mr/pl/pr, start-1/2 centring, and translate-x or transform-origin offsets that do not
 *   name an rtl: counterpart;
 * - physical CSS: text-align, float, left/right offsets, physical corner radii, border-left/right
 *   longhands and scroll-margin/padding-left/right inside stylesheets and inline styles;
 * - physical style bindings such as [style.left.px] and [style.marginLeft.px];
 * - arrow glyphs (left and right arrows) used as the only content of an element, or as loose text,
 *   without an rtl: mirror. Arrows are not Bidi_Mirrored characters, so unlike angle quotes they
 *   keep pointing the same way in RTL unless the element is flipped;
 * - directional Lucide icons (lucideArrowLeft, lucideChevronRight and similar) without the same
 *   rtl: mirror. Play, pause and other media controls never mirror and are not checked.
 *
 * Opt out of one line with `rtl-physical-ok` on that line, on the line before it, or in an HTML
 * comment above a multi-line element. Use it only for coordinates that are physical by design (for
 * example image pixels) and explain why next to it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OPT_OUT_MARKER = 'rtl-physical-ok';

const SCANNED_EXTENSIONS = new Set(['.html', '.ts', '.scss', '.css']);
const MIRROR_UTILITY = /(?<![\w-])rtl:(?:rotate-180|-scale-x-100|scale-x-\[-1\])(?![\w-])/;
const ARROW_GLYPH = /[←→]|&(?:larr|rarr);|&#(?:8592|8594);|&#x(?:2190|2192);/gi;

const tokenRule = (code, body, remediation, pairedBy = null) => ({
  code,
  remediation,
  pairedBy,
  pattern: new RegExp(`(?<![\\w-])${body}(?![\\w-])`, 'g'),
});

const CLASS_RULES = [
  tokenRule('physical-text-align', 'text-(?:left|right)', 'Use text-start or text-end.'),
  tokenRule(
    'physical-corner-radius',
    'rounded-(?:l|r|tl|tr|bl|br)(?:-[\\w./%\\[\\]-]+)?',
    'Use rounded-s, rounded-e, rounded-ss, rounded-se, rounded-es or rounded-ee.',
  ),
  tokenRule(
    'physical-float',
    '(?:float|clear)-(?:left|right)',
    'Use float-start, float-end, clear-start or clear-end.',
  ),
  tokenRule(
    'physical-scroll-spacing',
    'scroll-[mp][lr]-[\\w./%\\[\\]-]+',
    'Use scroll-ms, scroll-me, scroll-ps or scroll-pe.',
  ),
  tokenRule(
    'physical-translate',
    '-?translate-x-[\\w./%\\[\\]-]+',
    'translate-x moves the same way in both directions. Place with margin-inline or inset-inline ' +
      'utilities, centre with inset-x-0 mx-auto w-fit, or add an rtl: counterpart.',
    /(?<![\w-])(?:rtl|ltr):-?translate-x-/,
  ),
  tokenRule(
    'physical-centre-offset',
    '(?:start|end)-1\\/2',
    'An inline offset of 50% only centres in LTR once translated. Centre with inset-x-0 mx-auto w-fit.',
  ),
  tokenRule(
    'physical-transform-origin',
    'origin-(?:left|right|top-left|top-right|bottom-left|bottom-right)',
    'Transform origins have no logical keyword. Add an rtl: counterpart or an explicit opt out.',
    /(?<![\w-])(?:rtl|ltr):origin-/,
  ),
];

const STYLE_BINDING_RULE = {
  code: 'physical-style-binding',
  pattern: /\[style\.(?:left|right|(?:margin|padding|border)-?(?:left|right))(?=[.\]])/gi,
  remediation:
    'Bind inset-inline-start, inset-inline-end, margin-inline-* or padding-inline-* instead.',
};

const CSS_RULES = [
  {
    code: 'physical-css-text-align',
    pattern: /(?<![\w-])text-align\s*:\s*(?:left|right)\b/g,
    remediation: 'Use text-align: start or text-align: end.',
  },
  {
    code: 'physical-css-float',
    pattern: /(?<![\w-])(?:float|clear)\s*:\s*(?:left|right)\b/g,
    remediation: 'Use inline-start or inline-end.',
  },
  {
    code: 'physical-css-offset',
    pattern: /(?<![\w-])(?:left|right)\s*:\s*[^\s;}]/g,
    remediation: 'Use inset-inline-start or inset-inline-end.',
  },
  {
    code: 'physical-css-radius',
    pattern: /(?<![\w-])border-(?:top|bottom)-(?:left|right)-radius\s*:/g,
    remediation: 'Use border-start-start-radius, border-start-end-radius and the end-* variants.',
  },
  {
    code: 'physical-css-border',
    pattern: /(?<![\w-])border-(?:left|right)-(?:width|style|color)\s*:/g,
    remediation: 'Use border-inline-start-* or border-inline-end-*.',
  },
  {
    code: 'physical-css-scroll-spacing',
    pattern: /(?<![\w-])scroll-(?:margin|padding)-(?:left|right)\s*:/g,
    remediation: 'Use scroll-margin-inline-* or scroll-padding-inline-*.',
  },
];

const DIRECTIONAL_ICON_NAME =
  /\bname\s*=\s*"lucide(?:Arrow(?:Big)?|Chevrons?|Move|Corner[A-Za-z]*)(?:Left|Right)"/;

const ICON_REMEDIATION =
  'Add rtl:rotate-180 to the <ng-icon> so back, forward, previous and next icons follow the ' +
  'reading direction.';

const GLYPH_REMEDIATION =
  'Wrap the arrow in <span class="inline-block rtl:rotate-180"> so it points along the reading ' +
  'direction. Add aria-hidden="true" only when the control already has an accessible name.';

/** A start tag, end tag or comment. Quoted attribute values may contain `>` (for example `a > b`). */
const TAG_PATTERN = /<(\/)?([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/)?>|<!--[\s\S]*?-->/g;

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collectTemplateLiterals(source, pattern) {
  const blocks = [];
  for (const match of source.matchAll(pattern)) {
    const start = (match.index ?? 0) + match[0].indexOf('`') + 1;
    blocks.push({ text: match[1], lineOffset: lineNumber(source, start) - 1 });
  }
  return blocks;
}

/** Angular templates: the whole `.html` file, or every inline `template: \`...\`` literal. */
function extractTemplates(source, file) {
  if (file.endsWith('.html')) return [{ text: source, lineOffset: 0 }];
  if (!file.endsWith('.ts')) return [];
  return collectTemplateLiterals(source, /\btemplate\s*:\s*`((?:\\.|[^`\\])*)`/gs);
}

/** Stylesheet text: the whole `.scss` or `.css` file, or inline `styles: [\`...\`]` literals. */
function extractStyleBlocks(source, file) {
  if (file.endsWith('.scss') || file.endsWith('.css')) return [{ text: source, lineOffset: 0 }];
  if (!file.endsWith('.ts')) return [];
  const blocks = [];
  for (const declaration of source.matchAll(
    /\bstyles\s*:\s*\[?\s*((?:`(?:\\.|[^`\\])*`\s*,?\s*)+)\]?/gs,
  )) {
    const literals = declaration[1];
    const base = (declaration.index ?? 0) + declaration[0].indexOf(literals);
    for (const literal of literals.matchAll(/`((?:\\.|[^`\\])*)`/gs)) {
      blocks.push({
        text: literal[1],
        lineOffset: lineNumber(source, base + (literal.index ?? 0) + 1) - 1,
      });
    }
  }
  return blocks;
}

/** For every line, the line where the start tag it belongs to begins (itself outside a tag). */
function tagStartLines(text) {
  const starts = text.split('\n').map((_, index) => index);
  for (const match of text.matchAll(TAG_PATTERN)) {
    if (match[0].startsWith('<!--') || match[1]) continue;
    const first = lineNumber(text, match.index ?? 0) - 1;
    const last = lineNumber(text, (match.index ?? 0) + match[0].length - 1) - 1;
    for (let line = first; line <= last; line += 1) starts[line] = first;
  }
  return starts;
}

/**
 * A line is opted out by the marker on the line itself, on the line before it, or on the line
 * before the start tag it sits in (an HTML comment above a multi-line element).
 */
function isOptedOut(lines, tagStarts, lineIndex) {
  return [lineIndex, lineIndex - 1, tagStarts[lineIndex] - 1].some(
    (candidate) => candidate >= 0 && lines[candidate].includes(OPT_OUT_MARKER),
  );
}

function scanLines(text, lineOffset, rules, file, violations) {
  const lines = text.split('\n');
  const tagStarts = tagStartLines(text);
  lines.forEach((line, index) => {
    if (isOptedOut(lines, tagStarts, index)) return;
    for (const rule of rules) {
      if (rule.pairedBy?.test(line)) continue;
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (!match) continue;
      violations.push({
        file,
        line: lineOffset + index + 1,
        code: rule.code,
        found: match[0],
        remediation: rule.remediation,
      });
    }
  });
}

/**
 * Finds arrow glyphs that sit in an element (or loose text) without an rtl: mirror. Walks the
 * template once, keeping the stack of open start tags, so the innermost enclosing element decides.
 */
function scanDirectionalGlyphs(template, file, violations) {
  const lines = template.text.split('\n');
  const tagStarts = tagStartLines(template.text);
  const stack = [];
  let cursor = 0;

  const inspectText = (from, to) => {
    const text = template.text.slice(from, to);
    // Interpolations and control-flow braces are expressions, not rendered arrow text.
    const stripped = text.replace(/\{\{[\s\S]*?\}\}/g, (match) => ' '.repeat(match.length));
    for (const match of stripped.matchAll(ARROW_GLYPH)) {
      const enclosing = stack[stack.length - 1];
      if (enclosing && MIRROR_UTILITY.test(enclosing.attributes)) continue;
      const absolute = from + (match.index ?? 0);
      const line = lineNumber(template.text, absolute);
      if (isOptedOut(lines, tagStarts, line - 1)) continue;
      violations.push({
        file,
        line: template.lineOffset + line,
        code: 'unmirrored-direction-glyph',
        found: match[0],
        remediation: GLYPH_REMEDIATION,
      });
    }
  };

  for (const match of template.text.matchAll(TAG_PATTERN)) {
    inspectText(cursor, match.index ?? 0);
    cursor = (match.index ?? 0) + match[0].length;
    if (match[0].startsWith('<!--')) continue;

    const [, closing, rawName, attributes = '', selfClosing] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      const openIndex = stack.map((entry) => entry.name).lastIndexOf(name);
      if (openIndex !== -1) stack.length = openIndex;
    } else {
      if (
        name === 'ng-icon' &&
        DIRECTIONAL_ICON_NAME.test(attributes) &&
        !MIRROR_UTILITY.test(attributes)
      ) {
        const line = lineNumber(template.text, match.index ?? 0);
        if (!isOptedOut(lines, tagStarts, line - 1)) {
          violations.push({
            file,
            line: template.lineOffset + line,
            code: 'unmirrored-direction-icon',
            found: attributes.match(DIRECTIONAL_ICON_NAME)?.[0] ?? name,
            remediation: ICON_REMEDIATION,
          });
        }
      }
      if (!selfClosing && !VOID_ELEMENTS.has(name)) stack.push({ name, attributes });
    }
  }
  inspectText(cursor, template.text.length);
}

/** Returns the audit violations for one source file. Pure, so it is unit tested directly. */
export function scanRtlSource(source, file = '(source)') {
  const violations = [];

  scanLines(source, 0, CLASS_RULES, file, violations);

  for (const template of extractTemplates(source, file)) {
    scanLines(template.text, template.lineOffset, [STYLE_BINDING_RULE], file, violations);
    scanDirectionalGlyphs(template, file, violations);
  }

  for (const block of extractStyleBlocks(source, file)) {
    scanLines(block.text, block.lineOffset, CSS_RULES, file, violations);
  }

  const seen = new Set();
  return violations
    .filter((violation) => {
      const key = `${violation.file}:${violation.line}:${violation.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

function* walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SCANNED_EXTENSIONS.has(extname(name)) && !name.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

export function runAudit(sourceRoot, projectRoot = resolve(sourceRoot, '..')) {
  const violations = [];
  for (const path of walk(sourceRoot)) {
    const file = relative(projectRoot, path).replaceAll('\\', '/');
    violations.push(...scanRtlSource(readFileSync(path, 'utf8'), file));
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const projectRoot = resolve(import.meta.dirname, '..');
  const violations = runAudit(resolve(projectRoot, 'src'), projectRoot);

  if (violations.length > 0) {
    console.error('RTL audit failed: layout that does not mirror for Arabic and Hebrew:');
    for (const violation of violations) {
      console.error(
        `- ${violation.file}:${violation.line} [${violation.code}] ${violation.found}\n    ${violation.remediation}`,
      );
    }
    console.error(
      `\nFor coordinates that are physical by design, add ${OPT_OUT_MARKER} on the same or previous line with the reason.`,
    );
    process.exit(1);
  }

  console.log('RTL audit passed: no unmirrored physical layout detected.');
}
