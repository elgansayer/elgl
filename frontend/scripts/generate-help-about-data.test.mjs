import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectProductionLicences,
  generateHelpAboutData,
  packageNameFromPath,
  resolveBuildInfo,
} from './generate-help-about-data.mjs';

async function temporaryFrontend(t) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'help-about-data-'));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  return rootDirectory;
}

test('resolveBuildInfo uses package version and CI run plus commit metadata', () => {
  assert.deepEqual(
    resolveBuildInfo(
      '2.0.0',
      { GITHUB_RUN_NUMBER: '314', GITHUB_SHA: 'abcdef1234567890' },
      'localsha',
    ),
    {
      appVersion: '2.0.0',
      buildNumber: '314.abcdef123456',
    },
  );
});

test('resolveBuildInfo has a deterministic local fallback', () => {
  assert.deepEqual(resolveBuildInfo('2.0.0', {}, '0123456789abcdef'), {
    appVersion: '2.0.0',
    buildNumber: 'local.0123456789ab',
  });
});

test('packageNameFromPath handles scoped and nested packages', () => {
  assert.equal(packageNameFromPath('node_modules/@angular/core'), '@angular/core');
  assert.equal(packageNameFromPath('node_modules/a/node_modules/@scope/b'), '@scope/b');
  assert.equal(packageNameFromPath('node_modules/a/node_modules/b'), 'b');
});

test('collectProductionLicences excludes dev-only packages and packages licence text', async (t) => {
  const rootDirectory = await temporaryFrontend(t);
  const productionDirectory = path.join(rootDirectory, 'node_modules', 'production-package');
  const developmentDirectory = path.join(rootDirectory, 'node_modules', 'development-package');
  await mkdir(productionDirectory, { recursive: true });
  await mkdir(developmentDirectory, { recursive: true });
  await writeFile(
    path.join(productionDirectory, 'package.json'),
    JSON.stringify({ name: 'production-package', version: '1.2.3', license: 'MIT' }),
  );
  await writeFile(path.join(productionDirectory, 'LICENSE'), 'Production package licence text\n');
  await writeFile(
    path.join(developmentDirectory, 'package.json'),
    JSON.stringify({ name: 'development-package', version: '9.9.9', license: 'ISC' }),
  );

  const licences = await collectProductionLicences(rootDirectory, {
    packages: {
      '': { version: '2.0.0' },
      'node_modules/production-package': { version: '1.2.3', license: 'MIT' },
      'node_modules/development-package': { version: '9.9.9', license: 'ISC', dev: true },
    },
  });

  assert.equal(licences.length, 1);
  assert.equal(licences[0].id, 'production-package@1.2.3');
  assert.equal(licences[0].licence, 'MIT');
  assert.equal(licences[0].licenceFile, 'LICENSE');
  assert.equal(licences[0].licenceText, 'Production package licence text');
});

test('generateHelpAboutData writes generated metadata and an auditable manifest', async (t) => {
  const rootDirectory = await temporaryFrontend(t);
  const packageDirectory = path.join(rootDirectory, 'node_modules', 'sample-package');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    path.join(rootDirectory, 'package.json'),
    `${JSON.stringify({ name: 'frontend', version: '3.4.5' }, null, 2)}\n`,
  );
  await writeFile(
    path.join(rootDirectory, 'package-lock.json'),
    `${JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          '': { name: 'frontend', version: '3.4.5' },
          'node_modules/sample-package': { version: '1.0.0', license: 'Apache-2.0' },
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'sample-package', version: '1.0.0', license: 'Apache-2.0' }),
  );
  await writeFile(path.join(packageDirectory, 'LICENSE.txt'), 'Apache licence text\n');

  const result = await generateHelpAboutData({
    rootDirectory,
    environment: { GITHUB_RUN_NUMBER: '88', GITHUB_SHA: 'fedcba9876543210' },
    localSha: 'ignored',
  });

  assert.deepEqual(result, {
    appVersion: '3.4.5',
    buildNumber: '88.fedcba987654',
    licenceCount: 1,
  });

  const buildInfo = await readFile(
    path.join(rootDirectory, 'src', 'app', 'generated', 'build-info.generated.ts'),
    'utf8',
  );
  assert.match(buildInfo, /GENERATED_APP_VERSION = '3\.4\.5'/);
  assert.match(buildInfo, /GENERATED_BUILD_NUMBER = '88\.fedcba987654'/);

  const manifest = JSON.parse(
    await readFile(
      path.join(rootDirectory, 'public', 'assets', 'generated', 'third-party-licences.json'),
      'utf8',
    ),
  );
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].name, 'sample-package');
  assert.equal(manifest[0].licence, 'Apache-2.0');
  assert.equal(manifest[0].licenceText, 'Apache licence text');
});
