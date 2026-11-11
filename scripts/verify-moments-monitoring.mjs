import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_ALERTS = [
  'MomentsForYouRankingLatencyHigh',
  'MomentsForYouDegradedRateHigh',
  'MomentsForYouEmptyRateHigh',
  'MomentsForYouRankingStalled',
  'MomentsForYouCandidatePoolThin',
  'MomentsForYouDegradedSourceSpike',
];

const REQUIRED_MONITORS = [
  '[Moments] For You ranking latency high',
  '[Moments] For You degraded request rate high',
  '[Moments] For You empty feed rate high',
  '[Moments] For You ranking stalled',
  '[Moments] For You candidate pool thin',
  '[Moments] Candidate source degradation spike',
];

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.prod.yml'];

const REQUIRED_METRICS = [
  'hellotalk_moments_for_you_ranking_duration_seconds',
  'hellotalk_moments_for_you_candidates',
  'hellotalk_moments_for_you_degraded_total',
];

function alertBlock(rules, alert) {
  const pattern = new RegExp(`- alert: ${alert}\\n([\\s\\S]*?)(?=\\n\\s+\\- alert: |\\n\\S|$)`);
  return rules.match(pattern)?.[1] ?? null;
}

export function validateMomentsMonitoring({
  prometheus,
  rules,
  monitors,
  agent,
  composeFiles,
  docs,
}) {
  const errors = [];

  if (!/^rule_files:\s*$/m.test(prometheus)) {
    errors.push('prometheus/prometheus.yml must define a rule_files block');
  }
  if (!/^\s+- \/etc\/prometheus\/moments\.rules\.yml\s*$/m.test(prometheus)) {
    errors.push('prometheus/prometheus.yml must load /etc/prometheus/moments.rules.yml');
  }

  if (!/^\s+- name: moments\s*$/m.test(rules)) {
    errors.push('prometheus/moments.rules.yml must define a moments rule group');
  }
  for (const alert of REQUIRED_ALERTS) {
    const block = alertBlock(rules, alert);
    if (block === null) {
      errors.push(`prometheus/moments.rules.yml is missing alert ${alert}`);
      continue;
    }
    if (!/^\s+expr: .*hellotalk_moments_for_you_/m.test(block)) {
      errors.push(`${alert} must query a hellotalk_moments_for_you_ metric`);
    }
    if (!/^\s+severity: (warning|critical)\s*$/m.test(block)) {
      errors.push(`${alert} must set a warning or critical severity label`);
    }
    if (!/^\s+summary: .+/m.test(block) || !/^\s+description: .+/m.test(block)) {
      errors.push(`${alert} must provide summary and description annotations`);
    }
  }

  let monitorsConfig;
  try {
    monitorsConfig = JSON.parse(monitors);
  } catch {
    errors.push('config/datadog/moments-monitors.json must be valid JSON');
  }
  const monitorList = monitorsConfig?.monitors ?? [];
  for (const name of REQUIRED_MONITORS) {
    const monitor = monitorList.find((candidate) => candidate.name === name);
    if (!monitor) {
      errors.push(`config/datadog/moments-monitors.json is missing monitor ${name}`);
      continue;
    }
    if (!String(monitor.query ?? '').includes('hellotalk_moments_for_you_')) {
      errors.push(`${name} must query a hellotalk_moments_for_you_ metric`);
    }
    if (!monitor.tags?.includes('service:hellotalk') || !monitor.tags?.includes('team:moments')) {
      errors.push(`${name} must carry the hellotalk service and moments team tags`);
    }
    if (!monitor.options?.thresholds) {
      errors.push(`${name} must define alert thresholds`);
    }
  }

  for (const metric of REQUIRED_METRICS) {
    if (!agent.includes(metric)) {
      errors.push(`config/datadog/datadog-agent.yaml must register ${metric}`);
    }
  }

  for (const compose of composeFiles) {
    if (!compose.includes('./prometheus/moments.rules.yml:/etc/prometheus/moments.rules.yml:ro')) {
      errors.push('compose configuration must mount the moments rules file read-only');
    }
  }

  for (const alert of REQUIRED_ALERTS) {
    if (!docs.includes(alert)) {
      errors.push(`docs/moments-monitoring.md must document ${alert}`);
    }
  }
  for (const metric of REQUIRED_METRICS) {
    if (!docs.includes(metric)) {
      errors.push(`docs/moments-monitoring.md must document ${metric}`);
    }
  }

  return errors;
}

export function loadMomentsMonitoring(root = ROOT) {
  const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
  return {
    prometheus: read('prometheus/prometheus.yml'),
    rules: read('prometheus/moments.rules.yml'),
    monitors: read('config/datadog/moments-monitors.json'),
    agent: read('config/datadog/datadog-agent.yaml'),
    composeFiles: COMPOSE_FILES.map((file) => read(file)),
    docs: read('docs/moments-monitoring.md'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateMomentsMonitoring(loadMomentsMonitoring());
  if (errors.length > 0) {
    console.error('Moments monitoring contract failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Moments monitoring contract passed.');
  }
}
