#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '..');

export const DEFAULT_ROOTS = [
  resolve(repositoryRoot, 'frontend/src/app'),
  resolve(repositoryRoot, 'admin-portal/src/app'),
];

const SOURCE_EXTENSIONS = new Set(['.html', '.ts']);
const TEST_FILE_PATTERN = /\.(?:spec|test|stories)\.ts$/;
const PRIMITIVE_PATH_PATTERN = /\/components\/ui\//;

function collectSourceFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(path, files);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    if (TEST_FILE_PATTERN.test(entry.name)) continue;
    if (PRIMITIVE_PATH_PATTERN.test(path.replaceAll('\\', '/'))) continue;
    files.push(path);
  }
  return files;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function hasBoundAttribute(attributes, names) {
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(?:^|\\s)(?:${escapedNames.join('|')})\\s*=\\s*(?:"[^"]+"|'[^']+')`,
    'i',
  );
  return pattern.test(attributes);
}

function hasExplicitAccessibleName(attributes) {
  const ariaLabel = attributes.match(
    /(?:^|\s)(?:aria-label|attr\.aria-label)\s*=\s*(["'])(.*?)\1/is,
  );
  if (ariaLabel?.[2]?.trim()) return true;

  if (hasBoundAttribute(attributes, ['[aria-label]', '[attr.aria-label]'])) {
    return true;
  }

  const labelledBy = attributes.match(
    /(?:^|\s)(?:aria-labelledby|attr\.aria-labelledby)\s*=\s*(["'])(.*?)\1/is,
  );
  if (labelledBy?.[2]?.trim()) return true;

  return hasBoundAttribute(attributes, ['[aria-labelledby]', '[attr.aria-labelledby]']);
}

function hasScreenReaderText(innerHtml) {
  return /class\s*=\s*(["'])[^"']*\b(?:sr-only|visually-hidden)\b[^"']*\1[^>]*>[\s\S]*?\S[\s\S]*?<\//i.test(
    innerHtml,
  );
}

function hasNamedImage(innerHtml) {
  return /<img\b[^>]*\balt\s*=\s*(["'])\s*[^\s"'][^"']*\1/i.test(innerHtml);
}

function hasVisibleText(innerHtml) {
  if (/{{[\s\S]*?}}/.test(innerHtml)) return true;
  if (/<ng-content\b/i.test(innerHtml)) return true;
  if (hasScreenReaderText(innerHtml) || hasNamedImage(innerHtml)) return true;

  const text = innerHtml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /@(if|else\s+if|else|for|switch|case|default|defer|placeholder|loading|error)\b[^{}]*\{?/gi,
      ' ',
    )
    .replace(/[{}]/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .trim();

  return text.length > 0;
}

function inspectElement({ source, file, match, tagName, attributes, innerHtml }) {
  if (hasExplicitAccessibleName(attributes) || hasVisibleText(innerHtml)) return null;

  return {
    file,
    line: lineNumberAt(source, match.index),
    tagName,
    message:
      'interactive control has no accessible name; add visible text, screen-reader text, aria-label, or aria-labelledby',
  };
}

export function auditSource(source, file = '<inline>') {
  const failures = [];
  const coveredRanges = [];
  const interactivePatterns = [
    {
      tagName: 'button',
      regex: /<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi,
      enabled: () => true,
    },
    {
      tagName: 'a',
      regex: /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,
      enabled: (attributes) =>
        /(?:^|\s)(?:href|routerLink|\[routerLink\]|\[href\])(?:\s|=|$)/i.test(attributes),
    },
  ];

  for (const { tagName, regex, enabled } of interactivePatterns) {
    for (const match of source.matchAll(regex)) {
      const attributes = match[1] ?? '';
      const innerHtml = match[2] ?? '';
      if (!enabled(attributes)) continue;
      coveredRanges.push([match.index, match.index + match[0].length]);
      const failure = inspectElement({
        source,
        file,
        match,
        tagName,
        attributes,
        innerHtml,
      });
      if (failure) failures.push(failure);
    }
  }

  const roleButtonPattern = /<([a-z][\w-]*)\b([^>]*\brole\s*=\s*(["'])button\3[^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  for (const match of source.matchAll(roleButtonPattern)) {
    const tagName = (match[1] ?? '').toLowerCase();
    if (tagName === 'button' || tagName === 'a') continue;
    const index = match.index;
    if (coveredRanges.some(([start, end]) => index >= start && index < end)) continue;

    const failure = inspectElement({
      source,
      file,
      match,
      tagName,
      attributes: match[2] ?? '',
      innerHtml: match[4] ?? '',
    });
    if (failure) failures.push(failure);
  }

  return failures;
}

export function auditRoots(roots = DEFAULT_ROOTS) {
  const failures = [];
  for (const root of roots) {
    for (const file of collectSourceFiles(root)) {
      const source = readFileSync(file, 'utf8');
      for (const failure of auditSource(source, relative(repositoryRoot, file))) {
        failures.push(failure);
      }
    }
  }
  return failures;
}

function main() {
  const failures = auditRoots();
  if (failures.length > 0) {
    console.error('Interactive accessible-name verification failed:');
    for (const failure of failures) {
      console.error(
        `- ${failure.file}:${failure.line} <${failure.tagName}> ${failure.message}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log('Interactive accessible-name contract verified.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
