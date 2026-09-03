import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function frontendPath(path: string): string {
  const candidates = [
    resolve(process.cwd(), path),
    resolve(process.cwd(), 'frontend', path),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));

  if (!match) {
    throw new Error(`Unable to locate frontend/${path}`);
  }

  return match;
}

describe('Angular frontend bootstrap contract', () => {
  const angularConfig = JSON.parse(
    readFileSync(frontendPath('angular.json'), 'utf8'),
  ) as {
    projects?: Record<
      string,
      {
        projectType?: string;
        sourceRoot?: string;
        schematics?: Record<string, { style?: string }>;
        architect?: {
          build?: {
            options?: {
              browser?: string;
              inlineStyleLanguage?: string;
              styles?: string[];
            };
          };
          serve?: { builder?: string };
          test?: { builder?: string };
        };
      }
    >;
  };
  const frontend = angularConfig.projects?.['frontend'];

  it('keeps frontend as the Angular application rooted at src', () => {
    expect(frontend?.projectType).toBe('application');
    expect(frontend?.sourceRoot).toBe('src');
    expect(frontend?.architect?.build?.options?.browser).toBe('src/main.ts');
    expect(frontend?.architect?.serve?.builder).toBe(
      '@angular/build:dev-server',
    );
    expect(frontend?.architect?.test?.builder).toBe('@angular/build:unit-test');
  });

  it('keeps SCSS as the component and global style contract', () => {
    expect(frontend?.schematics?.['@schematics/angular:component']?.style).toBe(
      'scss',
    );
    expect(frontend?.architect?.build?.options?.inlineStyleLanguage).toBe(
      'scss',
    );
    expect(frontend?.architect?.build?.options?.styles).toContain(
      'src/styles.scss',
    );
    expect(existsSync(frontendPath('src/styles.scss'))).toBe(true);
  });

  it('keeps Angular routing wired through the standalone application config', () => {
    const appConfig = readFileSync(frontendPath('src/app/app.config.ts'), 'utf8');
    const appRoutes = readFileSync(frontendPath('src/app/app.routes.ts'), 'utf8');

    expect(appConfig).toContain(
      'provideRouter(routes, withComponentInputBinding())',
    );
    expect(appRoutes).toContain('export const routes: Routes');
  });

  it('keeps the browser bootstrap entrypoint present', () => {
    const main = readFileSync(frontendPath('src/main.ts'), 'utf8');

    expect(main).toContain('bootstrapApplication');
    expect(main).toContain('appConfig');
  });
});
