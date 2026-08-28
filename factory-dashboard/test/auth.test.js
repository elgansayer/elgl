import assert from 'node:assert/strict';
import test from 'node:test';

import { authorisationMatches, dashboardCredentials } from '../src/auth.js';

test('rejects missing and documented placeholder passwords', () => {
  assert.throws(() => dashboardCredentials({}), /DASHBOARD_PASSWORD/);
  assert.throws(
    () => dashboardCredentials({ DASHBOARD_PASSWORD: 'changeme_use_a_strong_password' }),
    /DASHBOARD_PASSWORD/,
  );
  assert.throws(
    () => dashboardCredentials({ DASHBOARD_PASSWORD: 'short-password' }),
    /DASHBOARD_PASSWORD/,
  );
});

test('accepts only the configured basic authorisation value', () => {
  const credentials = dashboardCredentials({
    DASHBOARD_USER: 'operator',
    DASHBOARD_PASSWORD: 'correct horse battery staple',
  });
  const valid = `Basic ${Buffer.from('operator:correct horse battery staple').toString('base64')}`;
  const invalid = `Basic ${Buffer.from('operator:wrong horse battery staple').toString('base64')}`;

  assert.equal(authorisationMatches(valid, credentials), true);
  assert.equal(authorisationMatches(invalid, credentials), false);
  assert.equal(authorisationMatches('Bearer token', credentials), false);
  assert.equal(authorisationMatches(undefined, credentials), false);
});
