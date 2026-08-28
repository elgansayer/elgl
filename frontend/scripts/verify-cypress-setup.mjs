import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FILES = [
  'cypress/support/e2e.ts',
  'cypress/support/commands.ts',
  'cypress/e2e/cypress-setup.cy.ts',
  'cypress/e2e/app.cy.ts',
];

const REQUIRED_CONFIG_MARKERS = [
  'defineConfig',
  "baseUrl: 'http://localhost:4200'",
  "supportFile: 'cypress/support/e2e.ts'",
  "specPattern: 'cypress/e2e/**/*.cy.ts'",
];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function collectCypressSetupFailures({ pkg, lockfile, config, exists }) {
  const failures = [];

  const cypressVersion = pkg?.devDependencies?.cypress;
  const serverVersion = pkg?.devDependencies?.['start-server-and-test'];

  if (!nonEmptyString(cypressVersion)) {
    failures.push('cypress must be declared in frontend devDependencies');
  }
  if (!nonEmptyString(serverVersion)) {
    failures.push('start-server-and-test must be declared in frontend devDependencies');
  }

  if (!pkg?.scripts?.['cypress:open']?.includes('cypress open')) {
    failures.push('cypress:open must launch Cypress');
  }
  if (!pkg?.scripts?.e2e?.includes('cypress run')) {
    failures.push('e2e must execute cypress run');
  }
  if (!pkg?.scripts?.['e2e:ci']?.includes('start-server-and-test')) {
    failures.push('e2e:ci must wait for the Angular app before Cypress');
  }

  const lockedRoot = lockfile?.packages?.['']?.devDependencies ?? {};
  if (nonEmptyString(cypressVersion) && lockedRoot.cypress !== cypressVersion) {
    failures.push('package-lock root Cypress version must match package.json');
  }
  if (nonEmptyString(serverVersion) && lockedRoot['start-server-and-test'] !== serverVersion) {
    failures.push('package-lock root start-server-and-test version must match package.json');
  }
  if (!lockfile?.packages?.['node_modules/cypress']) {
    failures.push('package-lock must contain node_modules/cypress');
  }
  if (!lockfile?.packages?.['node_modules/start-server-and-test']) {
    failures.push('package-lock must contain node_modules/start-server-and-test');
  }

  for (const marker of REQUIRED_CONFIG_MARKERS) {
    if (!config.includes(marker)) {
      failures.push(`cypress.config.ts missing: ${marker}`);
    }
  }

  for (const file of REQUIRED_FILES) {
    if (!exists(file)) {
      failures.push(`missing Cypress setup file: ${file}`);
    }
  }

  return failures;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function verifyCypressSetup(root = process.cwd()) {
  let pkg;
  let lockfile;
  let config;

  try {
    pkg = readJson(path.join(root, 'package.json'));
  } catch (error) {
    return [`unable to read package.json: ${error instanceof Error ? error.message : 'unknown error'}`];
  }

  try {
    lockfile = readJson(path.join(root, 'package-lock.json'));
  } catch (error) {
    return [
      `unable to read package-lock.json: ${error instanceof Error ? error.message : 'unknown error'}`,
    ];
  }

  try {
    config = fs.readFileSync(path.join(root, 'cypress.config.ts'), 'utf8');
  } catch (error) {
    return [
      `unable to read cypress.config.ts: ${error instanceof Error ? error.message : 'unknown error'}`,
    ];
  }

  return collectCypressSetupFailures({
    pkg,
    lockfile,
    config,
    exists: (file) => fs.existsSync(path.join(root, file)),
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const failures = verifyCypressSetup();
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Cypress frontend installation/configuration contract passed.');
  }
}
