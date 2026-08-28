import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function frontendRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith('/frontend') || cwd.endsWith('\\frontend') ? cwd : join(cwd, 'frontend');
}

function walkTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return walkTypeScriptFiles(path);
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

const legacyRootRelativeCallers = new Set([
  'src/app/services/crash-report.service.ts',
  'src/app/services/error-handler.service.ts',
  'src/app/services/monetisation.service.ts',
  'src/app/services/notification-preferences.service.ts',
  'src/app/services/quick-poll.service.ts',
  'src/app/services/soundboard.service.ts',
  'src/app/services/user-interests.service.ts',
]);

const rootRelativeHttpCall =
  /\b(?:this\.)?(?:http|httpClient)\s*\.\s*(?:get|post|put|patch|delete)\s*(?:<[^;]*?>)?\s*\(\s*[`'"]\//g;

describe('HttpClient API base contract', () => {
  it('rejects new root-relative API calls outside the tracked legacy cleanup set', () => {
    const root = frontendRoot();
    const appRoot = join(root, 'src/app');
    const violations: string[] = [];

    for (const file of walkTypeScriptFiles(appRoot)) {
      const source = readFileSync(file, 'utf8');
      if (!rootRelativeHttpCall.test(source)) {
        rootRelativeHttpCall.lastIndex = 0;
        continue;
      }
      rootRelativeHttpCall.lastIndex = 0;

      const path = relative(root, file).replaceAll('\\', '/');
      if (!legacyRootRelativeCallers.has(path)) violations.push(path);
    }

    expect(violations).toEqual([]);
  });
});
