import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const mainPath = 'backend/src/main.ts';
const compatibilityPipePath = 'backend/src/common/pipes/sanitise-html.pipe.ts';
const richPipePath = 'backend/src/common/pipes/sanitise-rich-html.pipe.ts';
const richServicePath =
  'backend/src/common/content/rich-text-sanitiser.service.ts';
const frontendSanitiserPath =
  'frontend/src/app/services/html-sanitisation.service.ts';

const [main, compatibilityPipe, richPipe, richService, frontendSanitiser] =
  await Promise.all([
    readFile(mainPath, 'utf8'),
    readFile(compatibilityPipePath, 'utf8'),
    readFile(richPipePath, 'utf8'),
    readFile(richServicePath, 'utf8'),
    readFile(frontendSanitiserPath, 'utf8'),
  ]);

const failures = [];

if (/SanitiseHtmlPipe/.test(main)) {
  failures.push(`${mainPath}: legacy HTML pipe must not be registered globally`);
}
if (/new\s+SanitiseRichHtmlPipe/.test(main)) {
  failures.push(`${mainPath}: rich HTML pipe must be opt-in per field/route`);
}
if (/Object\.entries|Array\.isArray|for\s*\([^)]*\sin\s/.test(compatibilityPipe)) {
  failures.push(
    `${compatibilityPipePath}: compatibility pipe must not recursively mutate DTOs`,
  );
}
if (!compatibilityPipe.includes('@deprecated')) {
  failures.push(
    `${compatibilityPipePath}: compatibility pipe must direct callers to the explicit rich-text boundary`,
  );
}
if (!richPipe.includes('Rich text must be a string')) {
  failures.push(`${richPipePath}: explicit rich-text type check is missing`);
}
for (const required of [
  'ALLOWED_TAGS',
  'FORBID_TAGS',
  'FORBID_ATTR',
  'noopener noreferrer nofollow',
  'javascript:',
]) {
  if (!richService.includes(required)) {
    failures.push(`${richServicePath}: required policy marker is missing: ${required}`);
  }
}
for (const required of [
  "from 'dompurify'",
  'ALLOWED_TAGS: []',
  'ALLOWED_ATTR: []',
  'ALLOW_DATA_ATTR: false',
  "startsWith('javascript:')",
  "startsWith('data:')",
]) {
  if (!frontendSanitiser.includes(required)) {
    failures.push(
      `${frontendSanitiserPath}: strict DOMPurify boundary marker is missing: ${required}`,
    );
  }
}

const unsafeSinkPatterns = [
  ['Angular [innerHTML] binding', /\[\s*innerHTML\s*\]/],
  ['DomSanitizer HTML trust bypass', /\bbypassSecurityTrustHtml\s*\(/],
  ['direct innerHTML assignment', /\.innerHTML\s*=/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\s*\(/],
  ['document.write', /\bdocument\.write(?:ln)?\s*\(/],
];

for (const root of ['frontend/src/app', 'admin-portal/src/app']) {
  for (const path of await collectProductionSourceFiles(root)) {
    const source = await readFile(path, 'utf8');
    for (const [description, pattern] of unsafeSinkPatterns) {
      if (pattern.test(source)) {
        failures.push(`${path}: unreviewed unsafe HTML sink: ${description}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Content security boundary verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'Plain text stays in text sinks, unsafe browser HTML sinks are blocked, and rich HTML uses an explicit versioned DOMPurify policy.',
);

async function collectProductionSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectProductionSourceFiles(path)));
      continue;
    }
    if (!entry.isFile() || !/\.(?:html|ts)$/.test(entry.name)) {
      continue;
    }
    if (/\.(?:spec|test)\.ts$/.test(entry.name)) {
      continue;
    }
    files.push(path);
  }
  return files;
}
