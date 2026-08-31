import assert from 'node:assert/strict';
import test from 'node:test';

import { projectFor, projects, stateFile } from '../src/projects.js';

test('exposes both repository projects', () => {
  assert.deepEqual(Object.keys(projects()), ['hellotalk', 'workout-agent']);
  assert.equal(projectFor('workout-agent').repo, 'elgansayer/workout-agent');
});

test('rejects unknown project slugs', () => {
  assert.equal(projectFor('../etc'), null);
  assert.equal(projectFor('missing'), null);
});

test('allows only simple JSON state filenames', () => {
  const project = projectFor('hellotalk');
  assert.equal(stateFile(project, 'daemon.json'), '/factory-state/hellotalk/daemon.json');
  assert.throws(() => stateFile(project, '../secret.json'), /Invalid/);
});
