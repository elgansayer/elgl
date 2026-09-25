import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ProductionOptimisation {
  scripts?: boolean;
  styles?: {
    minify?: boolean;
    inlineCritical?: boolean;
  };
  fonts?: boolean;
}

interface AngularWorkspace {
  projects?: {
    frontend?: {
      architect?: {
        build?: {
          configurations?: {
            production?: {
              optimization?: ProductionOptimisation;
            };
          };
        };
      };
    };
  };
}

function isAngularWorkspace(value: unknown): value is AngularWorkspace {
  return typeof value === 'object' && value !== null;
}

describe('offline production build contract', () => {
  it('does not download external fonts while retaining production optimisation', () => {
    const parsed: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'angular.json'), 'utf8'));

    expect(isAngularWorkspace(parsed)).toBe(true);
    if (!isAngularWorkspace(parsed)) return;

    const optimisation =
      parsed.projects?.frontend?.architect?.build?.configurations?.production?.optimization;

    expect(optimisation).toEqual({
      scripts: true,
      styles: {
        minify: true,
        inlineCritical: true,
      },
      fonts: false,
    });
  });
});
