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

test('rejects deployments that lose the corporate-network TLS fallback', () => {
  const files = loadLiveKitTurnNetworkingFiles();
  const errors = verifyLiveKitTurnNetworking({
    ...files,
    compose: files.compose.replace(
      "'${LIVEKIT_TURN_TLS_PORT:-443}:${LIVEKIT_TURN_TLS_PORT:-443}'",
      "'5349:5349'",
    ),
  });

  assert.ok(
    errors.some(
      (error) =>
        error.includes('docker-compose.yml') && error.includes('LIVEKIT_TURN_TLS_PORT'),
    ),
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
