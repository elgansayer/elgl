#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_COPY_ESCAPE = 'translation-static-ok';
const PRODUCT_ACTION_TEXT = /^(?:add|apply|back|block|buy|cancel|close|confirm|continue|create|delete|done|edit|follow|join|leave|next|open|pay|remove|report|retry|save|search|send|settings|share|skip|submit|unblock|unfollow|update|upload|view)$/i;
const STATIC_ASSISTIVE_ATTRIBUTE = /\b(?:aria-label|aria-description|placeholder|title)\s*=\s*(["'])([^"']*[A-Za-z][^"']*)\1/;
const INLINE_BUTTON_TEXT = /<button\b[^>]*>\s*([^<{]*[A-Za-z][^<{]*)\s*<\/button>/i;
const I18N_SERVICE = /\bI18nService\b/;
const KEY_INPUT = /\b(?:readonly\s+)?(?:[A-Za-z_$][\w$]*(?:Key|TranslationKey)|translationKey)\s*=\s*input(?:\.required)?\s*</;
const GENERIC_PRIMITIVE_PATH = /(?:^|\/)(?:components\/primitives|components\/ui|shared\/ui|ui\/primitives)(?:\/|$)/;

export function scanAddedTemplateLine(line, file = '(template)') {
  if (line.includes(STATIC_COPY_ESCAPE)) return [];
  const failures = [];
  const assistive = line.match(STATIC_ASSISTIVE_ATTRIBUTE);
  if (assistive) {
    failures.push(
      `${file}: hardcoded product/assistive copy in ${assistive[0].split('=')[0].trim()}; translate at the feature composition layer or annotate intentionally untranslated copy with ${STATIC_COPY_ESCAPE}`,
    );
  }
  const button = line.match(INLINE_BUTTON_TEXT);
  if (button) {
    const text = button[1].trim().replace(/\s+/g, ' ');
    if (text.includes(' ') || PRODUCT_ACTION_TEXT.test(text)) {
      failures.push(
        `${file}: hardcoded visible button copy "${text}"; use the translation layer or annotate intentionally untranslated copy with ${STATIC_COPY_ESCAPE}`,
      );
    }
  }
  return failures;
}

export function scanGenericPrimitiveSource(source, file = '(primitive)') {
  if (!GENERIC_PRIMITIVE_PATH.test(file.replaceAll('\\', '/'))) return [];
  if (!I18N_SERVICE.test(source) || !KEY_INPUT.test(source)) return [];
  return [
    `${file}: generic primitive couples a *Key/translationKey input to I18nService; accept a resolved semantic string instead`,
  ];
}

function resolveBase() {
  if (process.env.TRANSLATION_SAFE_BASE_SHA) return process.env.TRANSLATION_SAFE_BASE_SHA;
  try {
    return execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'HEAD^';
  }
}

function changedFrontendDiff(base) {
  try {
    return execFileSync(
      'git',
      ['diff', '--unified=0', `${base}...HEAD`, '--', 'frontend/src/app'],
      { cwd: root, encoding: 'utf8' },
    );
  } catch (error) {
    console.error(`Unable to calculate translation-safe API diff from ${base}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function verify() {
  const base = resolveBase();
  const diff = changedFrontendDiff(base);
  const failures = [];
  const changedTypescript = new Set();
  let file = '(unknown)';

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      if (file.endsWith('.ts')) changedTypescript.add(file);
      continue;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (file.endsWith('.html')) failures.push(...scanAddedTemplateLine(line.slice(1), file));
  }

  for (const path of changedTypescript) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;
    failures.push(...scanGenericPrimitiveSource(readFileSync(absolute, 'utf8'), path));
  }

  if (failures.length) {
    console.error('Translation-safe component API verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(
      `Keep product copy in the translation layer and generic primitives provider-agnostic. Use ${STATIC_COPY_ESCAPE} only for intentionally untranslated static copy.`,
    );
    process.exit(1);
  }

  console.log('Translation-safe component API contract verified.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) verify();
