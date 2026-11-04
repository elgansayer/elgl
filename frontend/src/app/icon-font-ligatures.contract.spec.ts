import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The application ships no icon font (see external-font-build.contract.spec.ts), so an icon-font
 * class prints its ligature name ("mic_off", "volume_up", "call_end") as visible words. Generic
 * vector icons come from @ng-icons/lucide, per docs/design/iconography-contract.md.
 */
const ICON_FONT_CLASS = /\bmaterial-(?:icons|symbols)(?:-[a-z]+)*\b/;
const ICON_FONT_PACKAGE = /material-icons|material-symbols|material-design-icons/;
const SCANNED_EXTENSIONS = new Set(['.html', '.ts', '.scss', '.css']);

function frontendRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith('/frontend') || cwd.endsWith('\\frontend') ? cwd : join(cwd, 'frontend');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    const scanned = SCANNED_EXTENSIONS.has(extname(name)) && !name.endsWith('.spec.ts');
    return scanned ? [path] : [];
  });
}

describe('icon font ligature contract', () => {
  it('does not use Material icon-font classes anywhere in application source', () => {
    const root = frontendRoot();
    const offenders = sourceFiles(join(root, 'src')).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          ICON_FONT_CLASS.test(line) ? [`${relative(root, path)}:${index + 1}`] : [],
        ),
    );

    expect(offenders).toEqual([]);
  });

  it('does not depend on an icon-font package that would compete with Lucide', () => {
    const packageJson = JSON.parse(readFileSync(join(frontendRoot(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packages = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });

    expect(packages.filter((name) => ICON_FONT_PACKAGE.test(name))).toEqual([]);
    expect(packages).toContain('@ng-icons/lucide');
  });
});
