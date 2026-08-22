import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

interface BackendPackageJson {
  name?: string;
  private?: boolean;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface NestCliConfig {
  collection?: string;
  sourceRoot?: string;
  compilerOptions?: {
    deleteOutDir?: boolean;
  };
}

const backendRoot = fileURLToPath(new URL('..', import.meta.url));

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
  ) as T;
}

describe('NestJS backend bootstrap contract', () => {
  const packageJson = readJson<BackendPackageJson>('../package.json');
  const nestCli = readJson<NestCliConfig>('../nest-cli.json');

  it('keeps the backend as a private npm-managed NestJS package', () => {
    expect(packageJson.name).toBe('backend');
    expect(packageJson.private).toBe(true);
    expect(packageJson.packageManager).toMatch(/^npm@/);

    expect(packageJson.dependencies).toEqual(
      expect.objectContaining({
        '@nestjs/common': expect.any(String),
        '@nestjs/core': expect.any(String),
        '@nestjs/platform-express': expect.any(String),
        'reflect-metadata': expect.any(String),
        rxjs: expect.any(String),
      }),
    );

    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining({
        '@nestjs/cli': expect.any(String),
        '@nestjs/schematics': expect.any(String),
        '@nestjs/testing': expect.any(String),
        typescript: expect.any(String),
      }),
    );
  });

  it('retains the canonical Nest CLI source layout and clean build output', () => {
    expect(nestCli).toEqual(
      expect.objectContaining({
        collection: '@nestjs/schematics',
        sourceRoot: 'src',
        compilerOptions: expect.objectContaining({
          deleteOutDir: true,
        }),
      }),
    );
  });

  it('retains the standard build, development, production and test entry points', () => {
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        build: 'nest build',
        start: 'nest start',
        'start:dev': 'nest start --watch',
        'start:prod': 'node dist/main',
        test: 'vitest run',
        'test:e2e': expect.any(String),
        'lint:check': expect.any(String),
      }),
    );
  });

  it('keeps an npm lockfile beside the backend package manifest', () => {
    expect(existsSync(new URL('../package-lock.json', import.meta.url))).toBe(
      true,
    );
  });

  it('boots AppModule through NestFactory and listens on the configured port', () => {
    const mainSource = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');

    expect(mainSource).toContain("import { NestFactory } from '@nestjs/core'");
    expect(mainSource).toContain("import { AppModule } from './app.module'");
    expect(mainSource).toMatch(/NestFactory\.create\(AppModule\b/);
    expect(mainSource).toMatch(/app\.listen\(process\.env\.PORT \?\? 3000\)/);
  });

  it('keeps the contract rooted in the backend package instead of a generated sibling project', () => {
    expect(basename(backendRoot)).toBe('backend');
  });
});
