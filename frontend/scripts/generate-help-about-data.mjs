import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDirectory = path.resolve(scriptDirectory, '..');
const licenceFilePattern = /^(licen[cs]e|copying|notice)(\..+)?$/i;

function cleanToken(value, fallback) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._+-]/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function readLocalSha(rootDirectory) {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: rootDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function toTypeScriptString(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function licenceName(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === 'object' && typeof value.type === 'string' && value.type.trim()) {
    return value.type.trim();
  }
  return null;
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readLicenceText(packageDirectory) {
  try {
    const entries = await readdir(packageDirectory, { withFileTypes: true });
    const licenceFile = entries
      .filter((entry) => entry.isFile() && licenceFilePattern.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))[0];

    if (!licenceFile) {
      return { licenceFile: null, licenceText: null };
    }

    const licenceText = (await readFile(path.join(packageDirectory, licenceFile), 'utf8')).trim();
    return {
      licenceFile,
      licenceText: licenceText || null,
    };
  } catch {
    return { licenceFile: null, licenceText: null };
  }
}

export function resolveBuildInfo(packageVersion, environment = {}, localSha = 'unknown') {
  const appVersion = cleanToken(environment.APP_VERSION || packageVersion, '0.0.0');
  const commitSha = cleanToken(environment.GITHUB_SHA || localSha, 'unknown').slice(0, 12);
  const ciBuildNumber = cleanToken(
    environment.APP_BUILD_NUMBER || environment.GITHUB_RUN_NUMBER,
    '',
  );

  return {
    appVersion,
    buildNumber: ciBuildNumber ? `${ciBuildNumber}.${commitSha}` : `local.${commitSha}`,
  };
}

export function packageNameFromPath(packagePath) {
  const afterNodeModules = packagePath.split('node_modules/').at(-1);
  if (!afterNodeModules) {
    return null;
  }

  const parts = afterNodeModules.split('/').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  if (parts[0].startsWith('@')) {
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

export async function collectProductionLicences(rootDirectory, packageLock) {
  if (!packageLock || typeof packageLock !== 'object' || !packageLock.packages) {
    throw new Error('PACKAGE_LOCK_PACKAGES_REQUIRED');
  }

  const licences = [];
  const seen = new Set();

  for (const [packagePath, lockMetadata] of Object.entries(packageLock.packages)) {
    if (
      !packagePath.includes('node_modules/') ||
      !lockMetadata ||
      typeof lockMetadata !== 'object' ||
      lockMetadata.dev === true
    ) {
      continue;
    }

    const name = packageNameFromPath(packagePath);
    const version = typeof lockMetadata.version === 'string' ? lockMetadata.version.trim() : '';
    if (!name || !version) {
      continue;
    }

    const id = `${name}@${version}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const packageDirectory = path.join(rootDirectory, packagePath);
    const installedMetadata = await readJsonOrNull(path.join(packageDirectory, 'package.json'));
    const installedLicence =
      installedMetadata && typeof installedMetadata === 'object'
        ? licenceName(installedMetadata.license)
        : null;
    const lockLicence = licenceName(lockMetadata.license);
    const licence = installedLicence || lockLicence;
    if (!licence) {
      throw new Error(`PRODUCTION_DEPENDENCY_LICENCE_REQUIRED:${id}`);
    }

    const { licenceFile, licenceText } = await readLicenceText(packageDirectory);

    licences.push({
      id,
      name,
      version,
      licence,
      packageUrl: `https://www.npmjs.com/package/${encodeURIComponent(name)}/v/${encodeURIComponent(version)}`,
      licenceFile,
      licenceText,
    });
  }

  return licences.sort((left, right) =>
    left.name === right.name
      ? left.version.localeCompare(right.version)
      : left.name.localeCompare(right.name),
  );
}

export async function generateHelpAboutData({
  rootDirectory = defaultRootDirectory,
  environment = process.env,
  localSha = readLocalSha(rootDirectory),
} = {}) {
  const packageJsonPath = path.join(rootDirectory, 'package.json');
  const packageLockPath = path.join(rootDirectory, 'package-lock.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));

  const packageVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
  const { appVersion, buildNumber } = resolveBuildInfo(packageVersion, environment, localSha);
  const licences = await collectProductionLicences(rootDirectory, packageLock);

  const generatedSourceDirectory = path.join(rootDirectory, 'src', 'app', 'generated');
  const generatedPublicDirectory = path.join(rootDirectory, 'public', 'assets', 'generated');
  await mkdir(generatedSourceDirectory, { recursive: true });
  await mkdir(generatedPublicDirectory, { recursive: true });

  const buildInfoSource = [
    '// Generated by scripts/generate-help-about-data.mjs. Do not edit by hand.',
    `export const GENERATED_APP_VERSION = ${toTypeScriptString(appVersion)};`,
    `export const GENERATED_BUILD_NUMBER = ${toTypeScriptString(buildNumber)};`,
    '',
  ].join('\n');

  await writeFile(
    path.join(generatedSourceDirectory, 'build-info.generated.ts'),
    buildInfoSource,
    'utf8',
  );
  await writeFile(
    path.join(generatedPublicDirectory, 'third-party-licences.json'),
    `${JSON.stringify(licences, null, 2)}\n`,
    'utf8',
  );

  return { appVersion, buildNumber, licenceCount: licences.length };
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedFile) {
  generateHelpAboutData().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
