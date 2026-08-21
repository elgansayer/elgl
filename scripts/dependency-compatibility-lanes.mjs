#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const LANE_LABELS = Object.freeze({
  runtime: 'compat:runtime-compiler',
  frontend: 'compat:frontend-tooling',
  backend: 'compat:backend-runtime',
  ci: 'compat:ci-build'
});

export const STATE_LABELS = Object.freeze({
  active: 'compat:active',
  queued: 'compat:queued'
});

const COMPATIBILITY_LABELS = new Set([...Object.values(LANE_LABELS), ...Object.values(STATE_LABELS)]);

const LABEL_METADATA = Object.freeze({
  [LANE_LABELS.runtime]: ['1d76db', 'Major runtime, compiler, package-manager, or automation-toolchain upgrade'],
  [LANE_LABELS.frontend]: ['a2eeef', 'Major frontend framework, lint, test-environment, or UI-tooling upgrade'],
  [LANE_LABELS.backend]: ['0e8a16', 'Major backend runtime-library, data, auth, or service-client upgrade'],
  [LANE_LABELS.ci]: ['5319e7', 'Major GitHub Actions or CI/build-tool upgrade'],
  [STATE_LABELS.active]: ['2ea44f', 'Canonical active major dependency candidate for its compatibility lane'],
  [STATE_LABELS.queued]: ['fbca04', 'Queued behind the canonical active major dependency candidate in its lane']
});

function numericMajor(value) {
  const match = String(value ?? '').match(/(?:^|[^0-9])(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseDependencyBumps(title, body = '') {
  const bumps = [];
  const seen = new Set();
  const add = (name, from, to) => {
    const normalised = String(name).trim().replace(/^`|`$/g, '');
    const key = `${normalised.toLowerCase()}|${from}|${to}`;
    if (!normalised || seen.has(key)) return;
    seen.add(key);
    bumps.push({ name: normalised, from: String(from), to: String(to) });
  };

  const bodyPattern = /Updates\s+`([^`]+)`\s+from\s+`([^`]+)`\s+to\s+`([^`]+)`/gi;
  for (const match of body.matchAll(bodyPattern)) add(match[1], match[2], match[3]);

  const titlePattern = /bump\s+(.+?)\s+from\s+`?([^\s`]+)`?\s+to\s+`?([^\s`]+)`?(?:\s+in\s+|$)/i;
  const titleMatch = title.match(titlePattern);
  if (titleMatch) add(titleMatch[1], titleMatch[2], titleMatch[3]);

  return bumps;
}

export function isMajorDependencyPullRequest(pr) {
  const title = String(pr.title ?? '');
  if (/routine-minor-patch/i.test(title) || /routine-updates/i.test(title)) return false;
  return parseDependencyBumps(title, pr.body ?? '').some(({ from, to }) => {
    const fromMajor = numericMajor(from);
    const toMajor = numericMajor(to);
    return fromMajor !== null && toMajor !== null && toMajor > fromMajor;
  });
}

export function classifyCompatibilityLane(pr, files = []) {
  const bumps = parseDependencyBumps(pr.title ?? '', pr.body ?? '');
  const packages = bumps.map(({ name }) => name.toLowerCase()).join(' ');
  const paths = files.map((file) => String(file.filename ?? file).toLowerCase()).join(' ');
  const corpus = `${packages} ${String(pr.title ?? '').toLowerCase()} ${paths}`;

  if (/\b(node|typescript|ts-node|npm|pnpm|yarn|bun|hatchling|pytest|pytest-cov|ruff|mypy|pydantic)\b/.test(packages)) {
    return LANE_LABELS.runtime;
  }

  if (
    /(^|\s)actions\/|docker\/(?:build-push|login|setup-buildx)|github\/codeql-action/.test(packages) ||
    (paths.includes('.github/workflows/') && !paths.includes('frontend/') && !paths.includes('backend/'))
  ) {
    return LANE_LABELS.ci;
  }

  if (
    paths.includes('frontend/') ||
    paths.includes('admin-portal/') ||
    paths.includes('e2e/') ||
    /angular|eslint|jsdom|ngx-|ng-icons|ng2-charts|cypress|playwright|listr|lint-staged|tailwind|spartan/.test(corpus)
  ) {
    return LANE_LABELS.frontend;
  }

  if (
    paths.includes('backend/') ||
    /ioredis|redis|stripe|jwks|jose|nestjs|supabase|aws-sdk|nodemailer|centrifugo|livekit/.test(corpus)
  ) {
    return LANE_LABELS.backend;
  }

  if (paths.includes('automation/')) return LANE_LABELS.runtime;
  if (paths.includes('.github/')) return LANE_LABELS.ci;
  return LANE_LABELS.runtime;
}

export function chooseLaneStates(items) {
  const byLane = new Map();
  for (const item of items) {
    const values = byLane.get(item.lane) ?? [];
    values.push(item);
    byLane.set(item.lane, values);
  }

  const result = new Map();
  for (const values of byLane.values()) {
    values.sort((a, b) => a.number - b.number);
    const existingActive = values.find((item) => item.labels?.includes(STATE_LABELS.active));
    const active = existingActive ?? values[0];
    for (const item of values) {
      result.set(item.number, item.number === active.number ? STATE_LABELS.active : STATE_LABELS.queued);
    }
  }
  return result;
}

function repositoryParts() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes('/')) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/name');
  }
  return repository;
}

function apiHeaders() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repositoryParts()}${path}`, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers ?? {}) }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${options.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function listOpenPullRequests() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/pulls?state=open&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function listChangedFiles(number) {
  const files = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/pulls/${number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) return files;
  }
}

async function ensureLabels() {
  const existing = await github('/labels?per_page=100');
  const names = new Set(existing.map((label) => label.name));
  for (const [name, [color, description]] of Object.entries(LABEL_METADATA)) {
    if (names.has(name)) continue;
    await github('/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, description })
    });
  }
}

async function replaceCompatibilityLabels(pr, lane, state) {
  const preserved = (pr.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((label) => label && !COMPATIBILITY_LABELS.has(label));
  const labels = [...preserved, lane, state];
  await github(`/issues/${pr.number}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels })
  });
}

async function clearCompatibilityLabels(pr) {
  const current = (pr.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
  const labels = current.filter((label) => label && !COMPATIBILITY_LABELS.has(label));
  if (labels.length === current.length) return;
  await github(`/issues/${pr.number}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels })
  });
}

function isDependencyAutomation(pr) {
  const login = String(pr.user?.login ?? '').toLowerCase();
  return login === 'dependabot[bot]' || /^chore\(deps(?:-dev)?\):/i.test(pr.title ?? '');
}

async function writeSummary(items, states) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    '## Dependency compatibility lanes',
    '',
    '| PR | Lane | State | Upgrade |',
    '| --- | --- | --- | --- |'
  ];
  for (const item of items.sort((a, b) => a.number - b.number)) {
    const bump = parseDependencyBumps(item.pr.title, item.pr.body ?? '')
      .filter(({ from, to }) => numericMajor(to) > numericMajor(from))
      .map(({ name, from, to }) => `${name} ${from} → ${to}`)
      .join(', ');
    lines.push(`| #${item.number} | ${item.lane} | ${states.get(item.number)} | ${bump || 'major upgrade'} |`);
  }
  if (items.length === 0) lines.push('| — | — | — | No open major dependency upgrades |');
  await appendFile(summaryPath, `${lines.join('\n')}\n`);
}

export async function reconcileDependencyCompatibilityLanes() {
  await ensureLabels();
  const open = await listOpenPullRequests();
  const dependencyPulls = open.filter(isDependencyAutomation);
  const major = [];

  for (const pr of dependencyPulls) {
    if (!isMajorDependencyPullRequest(pr)) {
      await clearCompatibilityLabels(pr);
      continue;
    }
    const files = await listChangedFiles(pr.number);
    major.push({
      number: pr.number,
      pr,
      files,
      lane: classifyCompatibilityLane(pr, files),
      labels: (pr.labels ?? []).map((label) => label.name)
    });
  }

  const states = chooseLaneStates(major);
  for (const item of major) {
    await replaceCompatibilityLabels(item.pr, item.lane, states.get(item.number));
  }
  await writeSummary(major, states);

  const currentNumber = Number(process.env.CURRENT_PR_NUMBER || 0);
  if (currentNumber && states.get(currentNumber) === STATE_LABELS.queued) {
    const current = major.find((item) => item.number === currentNumber);
    const blocker = major.find(
      (item) => item.lane === current?.lane && states.get(item.number) === STATE_LABELS.active
    );
    throw new Error(
      `PR #${currentNumber} is queued in ${current?.lane}; canonical active candidate is #${blocker?.number}.`
    );
  }

  return { major, states };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  reconcileDependencyCompatibilityLanes().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
