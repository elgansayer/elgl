import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface AngularBuildConfiguration {
  projects?: {
    frontend?: {
      architect?: {
        build?: {
          configurations?: {
            production?: {
              optimization?: {
                fonts?: {
                  inline?: boolean;
                };
              };
            };
          };
        };
      };
    };
  };
}

describe('production font build contract', () => {
  it('does not require the external font host while compiling production assets', () => {
    const angularConfig: AngularBuildConfiguration = JSON.parse(
      readFileSync(resolve(process.cwd(), 'angular.json'), 'utf8'),
    );

    expect(
      angularConfig.projects?.frontend?.architect?.build?.configurations?.production?.optimization
        ?.fonts?.inline,
    ).toBe(false);
  });
});
