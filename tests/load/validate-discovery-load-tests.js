#!/usr/bin/env node
/**
 * Validation script for the Discovery load testing suite (Artillery).
 *
 * Ensures the Discovery Map and Matchmaking Artillery configurations are
 * production-ready:
 *   - the YAML files parse cleanly
 *   - the target and auth token templates do not rely on the unsupported
 *     "||" fallback syntax (Artillery 2.x renders it literally)
 *   - every endpoint uses the global /api prefix served by the NestJS app
 *   - the expect plugin and SLO thresholds are configured so the run gates
 *     on status codes and latency budgets
 *   - every processor function referenced by scenarios and hooks exists
 *   - filter variables use values the API actually accepts (ISO language
 *     codes, CEFR levels, documented gender values)
 *   - the helper step functions emit their context variables correctly
 *
 * Run with: npm run test:discovery-validate
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const LOAD_DIR = __dirname;
const FILES = ['discovery-map.load.yml', 'matchmaking.load.yml'];

const ISO_LANGUAGE_CODES = new Set([
  'en',
  'es',
  'fr',
  'de',
  'ja',
  'ko',
  'zh',
  'pt',
  'ar',
  'ru',
  'it',
]);

const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const DOCUMENTED_GENDERS = new Set(['male', 'female', 'other']);

let failures = 0;

function fail(fileName, message) {
  failures += 1;
  console.error(`  FAIL [${fileName}] ${message}`);
}

function check(fileName, condition, message) {
  if (!condition) {
    fail(fileName, message);
  }
}

function collectFunctionNames(flow, names) {
  for (const step of flow) {
    if (step && typeof step.function === 'string') {
      names.add(step.function);
    }
    if (step && Array.isArray(step.loop)) {
      collectFunctionNames(step.loop, names);
    }
  }
}

function collectUrls(flow, urls) {
  for (const step of flow) {
    if (step && typeof step === 'object') {
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const request = step[method];
        if (request && typeof request.url === 'string') {
          urls.push(request.url);
        }
      }
      if (step.loop) {
        collectUrls(step.loop, urls);
      }
    }
  }
}

function verifyHelperFunctions(fileName, processorPath, scenarioHooks) {
  const helperPath = path.resolve(LOAD_DIR, processorPath);
  check(
    fileName,
    fs.existsSync(helperPath),
    `processor file missing: ${processorPath}`,
  );
  if (!fs.existsSync(helperPath)) {
    return;
  }
  let helper;
  try {
    helper = require(helperPath);
  } catch (error) {
    fail(fileName, `processor could not be loaded: ${error.message}`);
    return;
  }
  for (const functionName of scenarioHooks) {
    check(
      fileName,
      typeof helper[functionName] === 'function',
      `scenario hook "${functionName}" is not exported by ${processorPath}`,
    );
  }
}

function verifyStepFunctions(fileName, flow, processorPath) {
  const helperPath = path.resolve(LOAD_DIR, processorPath);
  if (!fs.existsSync(helperPath)) {
    return;
  }
  const helper = require(helperPath);
  const names = new Set();
  collectFunctionNames(flow, names);
  for (const functionName of names) {
    check(
      fileName,
      typeof helper[functionName] === 'function',
      `flow function "${functionName}" is not exported by ${processorPath}`,
    );
  }
}

function verifyFilterVariables(fileName, variables) {
  if (!variables) {
    return;
  }
  for (const language of variables.native_languages || []) {
    check(
      fileName,
      ISO_LANGUAGE_CODES.has(language),
      `native language "${language}" is not an ISO 639-1 code`,
    );
  }
  for (const language of variables.target_languages || []) {
    check(
      fileName,
      ISO_LANGUAGE_CODES.has(language),
      `target language "${language}" is not an ISO 639-1 code`,
    );
  }
  for (const level of variables.proficiency_levels || []) {
    check(
      fileName,
      CEFR_LEVELS.has(level),
      `proficiency level "${level}" is not a CEFR level (A1-C2)`,
    );
  }
  for (const gender of variables.genders || []) {
    check(
      fileName,
      DOCUMENTED_GENDERS.has(gender),
      `gender "${gender}" is not a documented SearchQueryDto value`,
    );
  }
}

function verifyConfig(fileName, script) {
  const config = script.config || {};
  check(
    fileName,
    typeof config.target === 'string' && config.target.length > 0,
    'config.target is missing',
  );
  if (typeof config.target === 'string') {
    check(
      fileName,
      !config.target.includes('||'),
      `config.target contains unsupported "||" template syntax: ${config.target}`,
    );
  }

  const authorization =
    config.defaults &&
    config.defaults.headers &&
    config.defaults.headers.Authorization;
  check(
    fileName,
    typeof authorization === 'string' &&
      authorization.includes('TEST_USER_TOKEN'),
    'Authorization header must use $processEnvironment.TEST_USER_TOKEN',
  );
  if (typeof authorization === 'string') {
    check(
      fileName,
      !authorization.includes('||'),
      'Authorization header contains unsupported "||" template syntax',
    );
  }

  check(
    fileName,
    Boolean(config.plugins && config.plugins.expect),
    'plugins.expect must be enabled so expect blocks are enforced',
  );
  check(
    fileName,
    Array.isArray(config.ensure && config.ensure.thresholds) &&
      config.ensure.thresholds.length > 0,
    'ensure.thresholds must define SLO latency budgets',
  );

  verifyFilterVariables(fileName, config.variables);

  check(
    fileName,
    Array.isArray(script.scenarios) && script.scenarios.length > 0,
    'scenarios must not be empty',
  );

  const scenarioHooks = new Set();
  const allUrls = [];
  for (const scenario of script.scenarios || []) {
    if (Array.isArray(scenario.beforeRequest)) {
      for (const hook of scenario.beforeRequest) {
        scenarioHooks.add(hook);
      }
    }
    if (Array.isArray(scenario.afterResponse)) {
      for (const hook of scenario.afterResponse) {
        scenarioHooks.add(hook);
      }
    }
    if (Array.isArray(scenario.flow)) {
      verifyStepFunctions(fileName, scenario.flow, config.processor);
      collectUrls(scenario.flow, allUrls);
    }
  }
  verifyHelperFunctions(fileName, config.processor, scenarioHooks);

  for (const url of allUrls) {
    check(
      fileName,
      url.startsWith('/api/'),
      `endpoint "${url}" must use the global /api prefix`,
    );
  }
}

for (const fileName of FILES) {
  const filePath = path.join(LOAD_DIR, fileName);
  console.log(`Checking ${fileName}...`);
  if (!fs.existsSync(filePath)) {
    fail(fileName, 'file does not exist');
    continue;
  }
  let script;
  try {
    script = yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(fileName, `could not parse YAML: ${error.message}`);
    continue;
  }
  if (!script || typeof script !== 'object') {
    fail(fileName, 'YAML did not parse into a script object');
    continue;
  }
  verifyConfig(fileName, script);
}

// Verify the Discovery helper step functions behave as Artillery steps.
const discoveryHelpers = require(path.join(LOAD_DIR, 'helpers', 'discovery-helpers.js'));
for (const functionName of ['generateRandomLatitude', 'generateRandomLongitude']) {
  const vars = {};
  let doneCalled = false;
  discoveryHelpers[functionName](
    { vars },
    {},
    () => {
      doneCalled = true;
    },
  );
  const value = vars.latitude !== undefined ? vars.latitude : vars.longitude;
  check(
    'discovery-helpers.js',
    doneCalled === true,
    `${functionName} must call done() to continue the scenario`,
  );
  check(
    'discovery-helpers.js',
    typeof value === 'number' && Number.isFinite(value),
    `${functionName} must set a numeric context variable`,
  );
}

if (failures > 0) {
  console.error(
    `\nDiscovery load test validation FAILED with ${failures} issue(s).`,
  );
  process.exit(1);
}
console.log('\nDiscovery load test validation PASSED.');
process.exit(0);
