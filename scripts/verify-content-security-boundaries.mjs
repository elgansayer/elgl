import { readFile } from 'node:fs/promises';

const mainPath = 'backend/src/main.ts';
const compatibilityPipePath = 'backend/src/common/pipes/sanitise-html.pipe.ts';
const richPipePath = 'backend/src/common/pipes/sanitise-rich-html.pipe.ts';
const richServicePath =
  'backend/src/common/content/rich-text-sanitiser.service.ts';

const [main, compatibilityPipe, richPipe, richService] = await Promise.all([
  readFile(mainPath, 'utf8'),
  readFile(compatibilityPipePath, 'utf8'),
  readFile(richPipePath, 'utf8'),
  readFile(richServicePath, 'utf8'),
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

if (failures.length > 0) {
  console.error('Content security boundary verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'Plain text is not globally HTML-mutated and rich HTML uses an explicit versioned policy.',
);
