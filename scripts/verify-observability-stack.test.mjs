import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadObservabilityConfig,
  validateObservabilityConfig,
} from './verify-observability-stack.mjs';

const valid = loadObservabilityConfig();

test('checked-in observability configuration satisfies the contract', () => {
  assert.deepEqual(validateObservabilityConfig(valid), []);
});

test('rejects observability services outside the compose services block', () => {
  const compose = valid.compose.replace(/^  datadog:/m, 'datadog:');
  assert.match(
    validateObservabilityConfig({ ...valid, compose }).join('\n'),
    /datadog must be defined under/,
  );
});

test('rejects publicly exposed observability admin ports', () => {
  const compose = valid.compose.replace('127.0.0.1:3001:3000', '3001:3000');
  assert.match(
    validateObservabilityConfig({ ...valid, compose }).join('\n'),
    /Grafana UI must bind to loopback only/,
  );
});

test('rejects an insecure Grafana default password', () => {
  const compose = valid.compose.replace(
    '${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD must be set}',
    '${GRAFANA_ADMIN_PASSWORD:-admin}',
  );
  const errors = validateObservabilityConfig({ ...valid, compose }).join('\n');
  assert.match(errors, /must not fall back to the default/);
  assert.match(errors, /must be supplied explicitly/);
});

test('rejects missing Centrifugo metrics configuration', () => {
  const centrifugo = JSON.stringify({
    ...JSON.parse(valid.centrifugo),
    prometheus: false,
  });
  assert.match(
    validateObservabilityConfig({ ...valid, centrifugo }).join('\n'),
    /Centrifugo Prometheus metrics must be enabled/,
  );
});
