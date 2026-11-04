import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function frontendRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith('/frontend') || cwd.endsWith('\\frontend') ? cwd : join(cwd, 'frontend');
}

function readFrontendFile(path: string): string {
  return readFileSync(join(frontendRoot(), path), 'utf8');
}

describe('Tailwind logical layout contract', () => {
  it('keeps Tailwind and its PostCSS integration installed', () => {
    const packageJson = JSON.parse(readFrontendFile('package.json')) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.['tailwindcss']).toBeTruthy();
    expect(packageJson.devDependencies?.['@tailwindcss/postcss']).toBeTruthy();
    expect(packageJson.devDependencies?.['postcss']).toBeTruthy();
  });

  it('loads Tailwind utilities and the project config from global styles', () => {
    const styles = readFrontendFile('src/styles.scss');

    expect(styles).not.toMatch(/@import\s+url\(/);
    expect(styles).toContain("@import 'tailwindcss/theme.css' layer(theme);");
    expect(styles).toContain("@import 'tailwindcss/preflight.css' layer(base);");
    expect(styles).toContain("@import 'tailwindcss/utilities.css';");
    expect(styles).toContain("@config '../tailwind.config.js';");
  });

  it('exports the Tailwind config in the frontend package module format', async () => {
    const configModule = await import('../../tailwind.config.js');

    expect(configModule.default).toMatchObject({
      darkMode: 'class',
      content: ['./src/**/*.{html,ts,scss}'],
    });
    expect(configModule.default.plugins).toHaveLength(1);
    expect(readFrontendFile('tailwind.config.d.ts')).toContain(
      "import type { Config } from 'tailwindcss';",
    );
  });

  it('keeps production styles independent of remote font stylesheets', () => {
    const styles = readFrontendFile('src/styles.scss');
    const serviceWorkerConfig = readFrontendFile('ngsw-config.json');

    expect(styles).not.toContain('fonts.googleapis.com');
    expect(serviceWorkerConfig).not.toContain('fonts.googleapis.com');
    expect(serviceWorkerConfig).not.toContain('fonts.gstatic.com');
  });

  it('scans Angular templates, TypeScript, and SCSS with class-based dark mode', () => {
    const config = readFrontendFile('tailwind.config.js');

    expect(config).toContain("darkMode: 'class'");
    expect(config).toContain("content: ['./src/**/*.{html,ts,scss}']");
  });

  it('defines inline safe-area spacing with logical utilities and properties', () => {
    const config = readFrontendFile('tailwind.config.js');

    expect(config).toContain("'.ps-safe'");
    expect(config).toContain("'.pe-safe'");
    expect(config).toContain('paddingInlineStart');
    expect(config).toContain('paddingInlineEnd');
    expect(config).toContain('"[dir=\'rtl\'] .ps-safe"');
    expect(config).toContain('"[dir=\'rtl\'] .pe-safe"');
    expect(config).not.toMatch(/\.(?:pl|pr)-safe/);
    expect(config).not.toMatch(/\bpadding(?:Left|Right)\b/);
  });

  it('enforces logical directional utilities in the canonical static-analysis path', () => {
    const packageJson = JSON.parse(readFrontendFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const rtlCheck = packageJson.scripts?.['check:rtl-logical'] ?? '';
    const lintCheck = packageJson.scripts?.['lint:check'] ?? '';

    expect(rtlCheck).toContain('pl-|pr-|ml-|mr-|left-|right-');
    expect(rtlCheck).toContain('margin-left|margin-right|padding-left|padding-right');
    expect(rtlCheck).toContain('ps/pe/ms/me/border-s/border-e');
    expect(rtlCheck).toContain('tailwind.config.js');
    expect(lintCheck).toContain('check:rtl-logical');
  });
});
