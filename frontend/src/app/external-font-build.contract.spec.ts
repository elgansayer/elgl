import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface AngularWorkspace {
  projects?: {
    frontend?: {
      architect?: {
        build?: {
          configurations?: {
            production?: {
              optimization?: {
                fonts?: boolean;
              };
            };
          };
        };
      };
    };
  };
}

describe('external font build contract', () => {
  it('does not make a production build depend on the Google Fonts endpoint', () => {
    const workspace: AngularWorkspace = JSON.parse(
      readFileSync(resolve(process.cwd(), 'angular.json'), 'utf8'),
    );

    expect(
      workspace.projects?.frontend?.architect?.build?.configurations?.production?.optimization
        ?.fonts,
    ).toBe(false);
  });
});
