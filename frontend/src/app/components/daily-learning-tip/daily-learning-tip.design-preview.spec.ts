import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = process.cwd();
const repositoryRoot = resolve(frontendRoot, '..');
const homePreviewPath = resolve(frontendRoot, 'design-preview/screens/home.html');
const manifestPath = resolve(repositoryRoot, 'design-sync.manifest.json');

function readHomePreview(): string {
  return readFileSync(homePreviewPath, 'utf8');
}

describe('DailyLearningTipComponent design-preview contract', () => {
  it('keeps the Home screen mapped to the authoritative Claude Design preview', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      items?: Array<{
        id?: string;
        previewPaths?: string[];
        requiredStates?: string[];
      }>;
    };
    const home = manifest.items?.find((item) => item.id === 'screen.home');

    expect(home?.previewPaths).toContain('frontend/design-preview/screens/home.html');
    expect(home?.requiredStates).toEqual(
      expect.arrayContaining(['light', 'dark', '390px', 'wide', 'rtl']),
    );
  });

  it('represents light mobile loading, fallback, and dark wide RTL success states', () => {
    const preview = readHomePreview();

    expect(preview).toContain('data-daily-tip-state="loading"');
    expect(preview).toContain('data-daily-tip-state="fallback"');
    expect(preview).toContain('data-daily-tip-state="success"');
    expect(preview).toContain('data-viewport="390px"');
    expect(preview).toContain('data-viewport="wide"');
    expect(preview).toContain('class="daily-tip-preview light mobile"');
    expect(preview).toContain('class="daily-tip-preview dark wide"');
    expect(preview).toContain('dir="rtl"');
  });

  it('keeps preview semantics aligned with the non-interactive Angular region contract', () => {
    const preview = readHomePreview();

    expect(preview).toMatch(/data-daily-tip-state="loading"[\s\S]*?role="region"/);
    expect(preview).toMatch(/role="region"[\s\S]*?aria-label="Daily learning tip"/);
    expect(preview).toContain('aria-busy="true"');
    expect(preview).toContain('aria-busy="false"');

    const showcase = preview.match(
      /<section class="daily-tip-showcase"[\s\S]*?<\/section>/,
    )?.[0];
    expect(showcase).toBeTruthy();
    expect(showcase).not.toMatch(/<button\b|<a\b|<input\b|tabindex=/);
  });
});
