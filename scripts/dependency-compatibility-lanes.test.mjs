import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LANE_LABELS,
  STATE_LABELS,
  chooseLaneStates,
  classifyCompatibilityLane,
  isMajorDependencyPullRequest,
  parseDependencyBumps
} from './dependency-compatibility-lanes.mjs';

test('parses Dependabot title and body upgrade forms', () => {
  assert.deepEqual(
    parseDependencyBumps('chore(deps): bump node from 22-alpine to 26-alpine in /backend'),
    [{ name: 'node', from: '22-alpine', to: '26-alpine' }]
  );
  assert.deepEqual(
    parseDependencyBumps(
      'chore(deps): grouped update',
      'Updates `ioredis` from `5.11.1` to `6.0.0`\nUpdates `uuid` from `14.0.0` to `14.0.1`'
    ),
    [
      { name: 'ioredis', from: '5.11.1', to: '6.0.0' },
      { name: 'uuid', from: '14.0.0', to: '14.0.1' }
    ]
  );
});

test('distinguishes major dependency work from routine grouped maintenance', () => {
  assert.equal(
    isMajorDependencyPullRequest({
      title: 'chore(deps-dev): bump typescript from 6.0.3 to 7.0.2 in /frontend',
      body: ''
    }),
    true
  );
  assert.equal(
    isMajorDependencyPullRequest({
      title: 'chore(deps): bump the routine-minor-patch group across 2 directories with 14 updates',
      body: 'Updates `eslint` from `10.8.0` to `10.8.1`'
    }),
    false
  );
});

test('classifies runtime and compiler upgrades before directory-specific lanes', () => {
  assert.equal(
    classifyCompatibilityLane(
      { title: 'chore(deps): bump node from 22-alpine to 26-alpine in /backend', body: '' },
      [{ filename: 'backend/Dockerfile' }]
    ),
    LANE_LABELS.runtime
  );
  assert.equal(
    classifyCompatibilityLane(
      { title: 'chore(deps-dev): bump typescript from 6.0.3 to 7.0.2 in /frontend', body: '' },
      [{ filename: 'frontend/package.json' }]
    ),
    LANE_LABELS.runtime
  );
});

test('classifies frontend, backend and CI major upgrades', () => {
  assert.equal(
    classifyCompatibilityLane(
      { title: 'chore(deps): bump @ngx-translate/core from 15.0.0 to 18.0.0', body: '' },
      [{ filename: 'frontend/package.json' }]
    ),
    LANE_LABELS.frontend
  );
  assert.equal(
    classifyCompatibilityLane(
      { title: 'chore(deps): bump ioredis from 5.11.1 to 6.0.0 in /backend', body: '' },
      [{ filename: 'backend/package.json' }]
    ),
    LANE_LABELS.backend
  );
  assert.equal(
    classifyCompatibilityLane(
      { title: 'chore(deps): bump actions/checkout from 6 to 7', body: '' },
      [{ filename: '.github/workflows/ci.yml' }]
    ),
    LANE_LABELS.ci
  );
});

test('keeps one stable active candidate in each lane and queues siblings', () => {
  const states = chooseLaneStates([
    { number: 20, lane: LANE_LABELS.frontend, labels: [] },
    { number: 10, lane: LANE_LABELS.frontend, labels: [] },
    { number: 30, lane: LANE_LABELS.backend, labels: [] }
  ]);
  assert.equal(states.get(10), STATE_LABELS.active);
  assert.equal(states.get(20), STATE_LABELS.queued);
  assert.equal(states.get(30), STATE_LABELS.active);

  const preserved = chooseLaneStates([
    { number: 10, lane: LANE_LABELS.frontend, labels: [] },
    { number: 20, lane: LANE_LABELS.frontend, labels: [STATE_LABELS.active] }
  ]);
  assert.equal(preserved.get(20), STATE_LABELS.active);
  assert.equal(preserved.get(10), STATE_LABELS.queued);
});
