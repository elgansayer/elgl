import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadLiveKitTurnNetworkingFiles,
  verifyLiveKitTurnNetworking,
} from './verify-livekit-turn-networking.mjs';

test('repository LiveKit networking configuration satisfies the production contract', () => {
  const errors = verifyLiveKitTurnNetworking(loadLiveKitTurnNetworkingFiles());
  assert.deepEqual(errors, []);
});

test('rejects API credentials committed to the LiveKit YAML', () => {
  const files = loadLiveKitTurnNetworkingFiles();
  const errors = verifyLiveKitTurnNetworking({
    ...files,
    livekitConfig: `${files.livekitConfig}\nkeys:\n  devkey: secret-livekit-api-secret-change-in-prod\n`,
  });

  assert.ok(errors.some((error) => error.includes('tracked API key material')));
  assert.ok(errors.some((error) => error.includes('known development credential')));
});

test('rejects tracked development credentials in environment examples', () => {
  const files = loadLiveKitTurnNetworkingFiles();
  const errors = verifyLiveKitTurnNetworking({
    ...files,
    rootEnvExample: `${files.rootEnvExample}\nLIVEKIT_API_KEY=devkey\n`,
    backendEnvExample: `${files.backendEnvExample}\nLIVEKIT_SECRET=secret\n`,
  });

  assert.ok(errors.some((error) => error.includes('.env.example contains the tracked')));
  assert.ok(errors.some((error) => error.includes('backend/.env.example contains a tracked')));
});

test('rejects deployments that lose the corporate-network TLS fallback', () => {
  const files = loadLiveKitTurnNetworkingFiles();
  const errors = verifyLiveKitTurnNetworking({
    ...files,
    compose: files.compose.replace("'443:443'", "'5349:5349'"),
  });

  assert.ok(
    errors.some((error) => error.includes('docker-compose.yml') && error.includes('443:443')),
  );
});

test('rejects a reintroduced broad RTC UDP exposure', () => {
  const files = loadLiveKitTurnNetworkingFiles();
  const errors = verifyLiveKitTurnNetworking({
    ...files,
    compose: `${files.compose}\n      - '50000-60000:50000-60000/udp'\n`,
  });

  assert.ok(errors.some((error) => error.includes('50000-60000')));
});
