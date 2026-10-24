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
                fonts?: boolean | { inline?: boolean };
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
    const fonts =
      workspace.projects?.frontend?.architect?.build?.configurations?.production?.optimization
        ?.fonts;

    // Either disable font optimisation entirely (`false`) or keep it without inlining
    // remote font CSS (`{ inline: false }`); both avoid a build-time Google Fonts fetch.
    const inlinesRemoteFonts =
      fonts === true || (typeof fonts === 'object' && fonts.inline !== false);

    expect(fonts).toBeDefined();
    expect(inlinesRemoteFonts).toBe(false);
  });
});
