import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIRROR_FOLDER = 'cypress-e2e-cache';

function isDirectoryWritable(directory, fsImpl) {
  try {
    fsImpl.accessSync(directory, fsImpl.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveCypressCacheEnvironment({ env, fsImpl, tmpdir, cypressVersion }) {
  const source = env.CYPRESS_CACHE_FOLDER;
  if (!source || !fsImpl.existsSync(source) || isDirectoryWritable(source, fsImpl)) {
    return env;
  }
  const mirror = path.join(tmpdir, MIRROR_FOLDER);
  if (!fsImpl.existsSync(path.join(mirror, cypressVersion))) {
    fsImpl.cpSync(source, mirror, { recursive: true });
  }
  return { ...env, CYPRESS_CACHE_FOLDER: mirror };
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedPath === modulePath) {
  const [command, ...commandArgs] = process.argv.slice(2);
  if (command !== 'cypress') {
    console.error('Usage: node scripts/cypress-e2e.mjs cypress <run|open> [args...]');
    process.exitCode = 1;
  } else {
    const frontendRoot = path.resolve(modulePath, '..', '..');
    const cypressPackagePath = path.join(frontendRoot, 'node_modules', 'cypress', 'package.json');
    const cypressBinPath = path.join(frontendRoot, 'node_modules', 'cypress', 'bin', 'cypress');
    const cypressVersion = JSON.parse(fs.readFileSync(cypressPackagePath, 'utf8')).version;
    const environment = resolveCypressCacheEnvironment({
      env: process.env,
      fsImpl: fs,
      tmpdir: os.tmpdir(),
      cypressVersion,
    });
    const child = spawn(process.execPath, [cypressBinPath, ...commandArgs], {
      cwd: frontendRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      console.error(`cypress-e2e: failed to start Cypress: ${error.message}`);
      process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
      process.exitCode = signal ? 1 : code === null ? 1 : code;
    });
  }
}
