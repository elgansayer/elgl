import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_HEALTH_URL = 'http://127.0.0.1:3000/api/health';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 2_000;
const DEFAULT_INTERVAL_MS = 250;
const MAX_INTERVAL_MS = 2_000;

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function parseBackendHealthUrl(value = DEFAULT_HEALTH_URL) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('E2E_BACKEND_HEALTH_URL must be a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('E2E_BACKEND_HEALTH_URL must use http or https');
  }

  if (url.username || url.password) {
    throw new Error('E2E_BACKEND_HEALTH_URL must not contain credentials');
  }

  return url;
}

export async function waitForBackend({
  healthUrl = parseBackendHealthUrl(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  intervalMs = DEFAULT_INTERVAL_MS,
  fetchImpl = globalThis.fetch,
  sleepImpl = sleep,
  now = Date.now,
  logger = console,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required');
  }

  const url = healthUrl instanceof URL ? healthUrl : parseBackendHealthUrl(healthUrl);
  const deadline = now() + timeoutMs;
  let attempt = 0;
  let lastStatus;

  while (now() < deadline) {
    attempt += 1;
    const controller = new AbortController();
    const attemptTimer = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
      });

      lastStatus = response.status;
      if (response.ok) {
        logger.info?.(`[e2e] backend ready after ${attempt} attempt${attempt === 1 ? '' : 's'}`);
        return;
      }
    } catch {
      // Connection refusal is expected while the NestJS webServer is still booting.
      // Do not log the thrown error because undici AggregateErrors can include local
      // socket details and they obscure the actual readiness state in QA output.
    } finally {
      clearTimeout(attemptTimer);
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;

    const backoffMs = Math.min(intervalMs * 2 ** Math.min(attempt - 1, 3), MAX_INTERVAL_MS);
    await sleepImpl(Math.min(backoffMs, remainingMs));
  }

  const statusSuffix = lastStatus === undefined ? '' : ` (last HTTP status ${lastStatus})`;
  throw new Error(`Backend did not become healthy within ${timeoutMs}ms${statusSuffix}`);
}

async function main() {
  const healthUrl = parseBackendHealthUrl(process.env.E2E_BACKEND_HEALTH_URL ?? DEFAULT_HEALTH_URL);
  const timeoutMs = parsePositiveInteger(
    process.env.E2E_BACKEND_READY_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    'E2E_BACKEND_READY_TIMEOUT_MS',
  );
  const attemptTimeoutMs = parsePositiveInteger(
    process.env.E2E_BACKEND_ATTEMPT_TIMEOUT_MS,
    DEFAULT_ATTEMPT_TIMEOUT_MS,
    'E2E_BACKEND_ATTEMPT_TIMEOUT_MS',
  );
  const intervalMs = parsePositiveInteger(
    process.env.E2E_BACKEND_READY_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    'E2E_BACKEND_READY_INTERVAL_MS',
  );

  await waitForBackend({ healthUrl, timeoutMs, attemptTimeoutMs, intervalMs });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[e2e] backend readiness failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
