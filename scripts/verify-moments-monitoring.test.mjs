import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMomentsMonitoring, validateMomentsMonitoring } from './verify-moments-monitoring.mjs';

const valid = loadMomentsMonitoring();

test('checked-in Moments monitoring configuration satisfies the contract', () => {
  assert.deepEqual(validateMomentsMonitoring(valid), []);
});

test('rejects a Prometheus configuration that omits the moments rule file', () => {
  const prometheus = valid.prometheus.replace('  - /etc/prometheus/moments.rules.yml\n', '');
  assert.match(
    validateMomentsMonitoring({ ...valid, prometheus }).join('\n'),
    /must load \/etc\/prometheus\/moments.rules.yml/,
  );
});

test('rejects missing Prometheus alerts', () => {
  const rules = valid.rules.replace(
    /      - alert: MomentsForYouRankingStalled[\s\S]*?(?=      - alert: |$)/,
    '',
  );
  assert.match(
    validateMomentsMonitoring({ ...valid, rules }).join('\n'),
    /missing alert MomentsForYouRankingStalled/,
  );
});

test('rejects missing Datadog monitors', () => {
  const parsed = JSON.parse(valid.monitors);
  parsed.monitors = parsed.monitors.filter(
    (monitor) => monitor.name !== '[Moments] For You ranking stalled',
  );
  const monitors = JSON.stringify(parsed);
  assert.match(
    validateMomentsMonitoring({ ...valid, monitors }).join('\n'),
    /missing monitor \[Moments\] For You ranking stalled/,
  );
});

test('rejects an Agent configuration that does not register the metrics', () => {
  const agent = valid.agent.replace(
    '      - hellotalk_moments_for_you_candidates: histogram\n',
    '',
  );
  assert.match(
    validateMomentsMonitoring({ ...valid, agent }).join('\n'),
    /must register hellotalk_moments_for_you_candidates/,
  );
});

test('rejects a compose file without the moments rules mount', () => {
  const composeFiles = [...valid.composeFiles];
  composeFiles[0] = composeFiles[0].replace(
    '      - ./prometheus/moments.rules.yml:/etc/prometheus/moments.rules.yml:ro\n',
    '',
  );
  assert.match(
    validateMomentsMonitoring({ ...valid, composeFiles }).join('\n'),
    /compose configuration must mount the moments rules file/,
  );
});
