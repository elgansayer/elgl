import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

function requireText(errors, fileLabel, source, snippet) {
  if (!source.includes(snippet)) {
    errors.push(`${fileLabel} is missing required LiveKit contract: ${snippet}`);
  }
}

function forbidText(errors, fileLabel, source, snippet) {
  if (source.includes(snippet)) {
    errors.push(`${fileLabel} contains forbidden LiveKit configuration: ${snippet}`);
  }
}

export function verifyLiveKitTurnNetworking({
  compose,
  livekitConfig,
  rootEnvExample,
  backendEnvExample,
  prometheusConfig,
}) {
  const errors = [];

  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'LIVEKIT_KEYS=${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required}: ${LIVEKIT_SECRET:?LIVEKIT_SECRET is required}',
  );
  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'LIVEKIT_TURN_DOMAIN=${LIVEKIT_TURN_DOMAIN:?LIVEKIT_TURN_DOMAIN is required}',
  );
  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'LIVEKIT_TURN_CERT_FILE=/run/secrets/livekit_turn_cert',
  );
  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'LIVEKIT_TURN_KEY_FILE=/run/secrets/livekit_turn_key',
  );
  requireText(errors, 'docker-compose.yml', compose, "'58000-58100:58000-58100/udp'");
  requireText(errors, 'docker-compose.yml', compose, "'443:443'");
  requireText(errors, 'docker-compose.yml', compose, "'3478:3478/udp'");
  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'file: ${LIVEKIT_TURN_CERT_FILE:?LIVEKIT_TURN_CERT_FILE is required}',
  );
  requireText(
    errors,
    'docker-compose.yml',
    compose,
    'file: ${LIVEKIT_TURN_KEY_FILE:?LIVEKIT_TURN_KEY_FILE is required}',
  );
  forbidText(errors, 'docker-compose.yml', compose, "'50000-60000:50000-60000/udp'");

  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'prometheus_port: 6789');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'port_range_start: 58000');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'port_range_end: 58100');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'use_external_ip: true');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'tls_port: 443');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'udp_port: 3478');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'external_tls: false');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'stun:stun.l.google.com:19302');
  requireText(errors, 'config/livekit/config.yaml', livekitConfig, 'stun:stun1.l.google.com:19302');

  if (/^\s*keys\s*:/m.test(livekitConfig)) {
    errors.push('config/livekit/config.yaml must not contain tracked API key material');
  }
  if (/secret-livekit|devkey/i.test(livekitConfig)) {
    errors.push('config/livekit/config.yaml contains a known development credential');
  }

  for (const [label, envExample] of [
    ['.env.example', rootEnvExample],
    ['backend/.env.example', backendEnvExample],
  ]) {
    requireText(errors, label, envExample, 'LIVEKIT_TURN_ENABLED=true');
    requireText(errors, label, envExample, 'LIVEKIT_TURN_TLS_PORT=443');
    requireText(errors, label, envExample, 'LIVEKIT_TURN_UDP_PORT=3478');
    requireText(errors, label, envExample, 'LIVEKIT_TURN_CERT_FILE=');
    requireText(errors, label, envExample, 'LIVEKIT_TURN_KEY_FILE=');
    forbidText(errors, label, envExample, 'LIVEKIT_TURN_USERNAME=');
    forbidText(errors, label, envExample, 'LIVEKIT_TURN_PASSWORD=');
  }

  requireText(errors, 'prometheus/prometheus.yml', prometheusConfig, "job_name: 'livekit'");
  requireText(errors, 'prometheus/prometheus.yml', prometheusConfig, "targets: ['sfu:6789']");

  return errors;
}

export function loadLiveKitTurnNetworkingFiles(root = repoRoot) {
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  return {
    compose: read('docker-compose.yml'),
    livekitConfig: read('config/livekit/config.yaml'),
    rootEnvExample: read('.env.example'),
    backendEnvExample: read('backend/.env.example'),
    prometheusConfig: read('prometheus/prometheus.yml'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = verifyLiveKitTurnNetworking(loadLiveKitTurnNetworkingFiles());

  if (errors.length > 0) {
    console.error('LiveKit TURN/STUN deployment contract failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('LiveKit TURN/STUN deployment contract verified.');
  }
}
