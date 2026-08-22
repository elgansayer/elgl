import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validateObservabilityConfig({
  compose,
  prometheus,
  grafanaDatasource,
  grafanaDashboardProvider,
  centrifugo,
}) {
  const errors = [];

  const servicesMatch = compose.match(/^services:\s*\n([\s\S]*?)(?=^volumes:\s*$)/m);
  const servicesBlock = servicesMatch?.[1] ?? '';
  if (!servicesMatch) {
    errors.push('docker-compose.prod.yml must define a services block before volumes');
  }

  for (const service of ['prometheus', 'grafana', 'datadog']) {
    if (!new RegExp(`^  ${service}:\\s*$`, 'm').test(servicesBlock)) {
      errors.push(`${service} must be defined under docker-compose.prod.yml services`);
    }
  }

  if (!compose.includes("'127.0.0.1:9090:9090'")) {
    errors.push('Prometheus UI must bind to loopback only (127.0.0.1:9090:9090)');
  }
  if (!compose.includes("'127.0.0.1:3001:3000'")) {
    errors.push('Grafana UI must bind to loopback only (127.0.0.1:3001:3000)');
  }
  if (/^\s*-\s*['\"]?8001:8001['\"]?\s*$/m.test(compose)) {
    errors.push('Centrifugo metrics port 8001 must not be published to the host');
  }
  if (compose.includes('GRAFANA_ADMIN_PASSWORD:-admin')) {
    errors.push('Grafana admin password must not fall back to the default "admin" password');
  }
  if (!compose.includes('GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:?')) {
    errors.push('Grafana admin password must be supplied explicitly through GRAFANA_ADMIN_PASSWORD');
  }

  const requiredScrapes = [
    ["job_name: 'hellotalk-nestjs'", "metrics_path: '/api/metrics'", "targets: ['api:3000']"],
    ["job_name: 'centrifugo'", "metrics_path: '/metrics'", "targets: ['websocket:8000']"],
  ];
  for (const scrape of requiredScrapes) {
    for (const marker of scrape) {
      if (!prometheus.includes(marker)) {
        errors.push(`Prometheus configuration is missing required marker: ${marker}`);
      }
    }
  }

  if (!grafanaDatasource.includes('url: http://prometheus:9090')) {
    errors.push('Grafana Prometheus datasource must target http://prometheus:9090');
  }
  if (!grafanaDatasource.includes('isDefault: true')) {
    errors.push('Grafana Prometheus datasource must be the default datasource');
  }
  if (!grafanaDashboardProvider.includes('path: /var/lib/grafana/dashboards')) {
    errors.push('Grafana dashboard provisioning must load /var/lib/grafana/dashboards');
  }

  let centrifugoConfig;
  try {
    centrifugoConfig = JSON.parse(centrifugo);
  } catch {
    errors.push('Centrifugo configuration must be valid JSON');
    return errors;
  }
  if (centrifugoConfig.prometheus !== true) {
    errors.push('Centrifugo Prometheus metrics must be enabled');
  }
  if (centrifugoConfig.engine !== 'redis') {
    errors.push('Centrifugo must use the Redis engine in production');
  }
  if (centrifugoConfig.redis_address !== 'redis://cache:6379') {
    errors.push('Centrifugo Redis address must target the compose cache service');
  }

  return errors;
}

export function loadObservabilityConfig(root = ROOT) {
  const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
  return {
    compose: read('docker-compose.prod.yml'),
    prometheus: read('prometheus/prometheus.yml'),
    grafanaDatasource: read('grafana/datasources/prometheus.yml'),
    grafanaDashboardProvider: read('grafana/provisioning/dashboards/dashboards.yml'),
    centrifugo: read('config/centrifugo/config.json'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateObservabilityConfig(loadObservabilityConfig());
  if (errors.length > 0) {
    console.error('Observability stack contract failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Observability stack contract passed.');
  }
}
