import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCREENSHOT_PATTERN = /^Screenshot_\d{8}_\d{6}(?:-\d+)?\.png$/;
const DOCUMENTED_SCREENSHOT_PATTERN = /`(Screenshot_\d{8}_\d{6}(?:-\d+)?\.png)`/g;

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

async function sha256(path) {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

export async function validateMomentsReferenceAnalysis({ repoRoot } = {}) {
  const root = repoRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const screenshotDir = join(root, 'original-hello-talk-screenshots');
  const analysisPath = join(root, 'docs', 'moments-feed-reference-analysis.md');

  const entries = await readdir(screenshotDir, { withFileTypes: true });
  const screenshotNames = entries
    .filter((entry) => entry.isFile() && SCREENSHOT_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (screenshotNames.length === 0) {
    throw new Error('Moments reference corpus is empty.');
  }

  const analysis = await readFile(analysisPath, 'utf8');
  const documentedNames = new Set(
    [...analysis.matchAll(DOCUMENTED_SCREENSHOT_PATTERN)].map((match) => match[1]),
  );
  const corpusNames = new Set(screenshotNames);

  const missingFromAnalysis = difference(corpusNames, documentedNames);
  const staleAnalysisEntries = difference(documentedNames, corpusNames);
  const errors = [];

  if (missingFromAnalysis.length > 0) {
    errors.push(`undocumented screenshots: ${missingFromAnalysis.join(', ')}`);
  }
  if (staleAnalysisEntries.length > 0) {
    errors.push(`stale screenshot references: ${staleAnalysisEntries.join(', ')}`);
  }

  const digestGroups = new Map();
  for (const name of screenshotNames) {
    const digest = await sha256(join(screenshotDir, name));
    const names = digestGroups.get(digest) ?? [];
    names.push(name);
    digestGroups.set(digest, names);
  }

  const duplicateGroups = [...digestGroups.values()]
    .filter((names) => names.length > 1)
    .map((names) => names.sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
  const analysisLines = analysis.split(/\r?\n/);

  for (const duplicateGroup of duplicateGroups) {
    const documentedTogether = analysisLines.some((line) =>
      duplicateGroup.every((name) => line.includes(`\`${name}\``)),
    );
    if (!documentedTogether) {
      errors.push(`duplicate aliases must share one inventory row: ${duplicateGroup.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Moments reference analysis drift detected:\n- ${errors.join('\n- ')}`);
  }

  return {
    screenshotCount: screenshotNames.length,
    uniqueCaptureCount: digestGroups.size,
    duplicateGroupCount: duplicateGroups.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateMomentsReferenceAnalysis();
    console.log(
      `Moments reference analysis verified: ${result.screenshotCount} files, ` +
        `${result.uniqueCaptureCount} unique captures, ${result.duplicateGroupCount} duplicate groups.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
