import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBackendHealthUrl, waitForBackend } from './backend-readiness.mjs';

test('retries transient connection failures until the backend is healthy', async () => {
  let calls = 0;
  let clock = 0;
  const messages = [];

  await waitForBackend({
    healthUrl: 'http://127.0.0.1:3000/api/health',
    timeoutMs: 5_000,
    attemptTimeoutMs: 50,
    intervalMs: 100,
    now: () => clock,
    sleepImpl: async (duration) => {
      clock += duration;
    },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      if (calls === 2) return { ok: false, status: 503 };
      return { ok: true, status: 200 };
    },
    logger: {
      info(message) {
        messages.push(message);
      },
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(messages, ['[e2e] backend ready after 3 attempts']);
});

test('fails with a bounded readiness error when the backend never starts', async () => {
  let clock = 0;

  await assert.rejects(
    waitForBackend({
      healthUrl: 'http://127.0.0.1:3000/api/health',
      timeoutMs: 300,
      attemptTimeoutMs: 50,
      intervalMs: 100,
      now: () => clock,
      sleepImpl: async (duration) => {
        clock += duration;
      },
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
      logger: { info() {} },
    }),
    /Backend did not become healthy within 300ms/,
  );
});

test('reports the last non-success status without leaking a response body', async () => {
  let clock = 0;

  await assert.rejects(
    waitForBackend({
      healthUrl: 'http://127.0.0.1:3000/api/health',
      timeoutMs: 100,
      attemptTimeoutMs: 50,
      intervalMs: 100,
      now: () => clock,
      sleepImpl: async (duration) => {
        clock += duration;
      },
      fetchImpl: async () => ({ ok: false, status: 503 }),
      logger: { info() {} },
    }),
    /last HTTP status 503/,
  );
});

test('accepts only HTTP(S) readiness URLs without embedded credentials', () => {
  assert.equal(parseBackendHealthUrl('http://127.0.0.1:3000/api/health').protocol, 'http:');
  assert.equal(parseBackendHealthUrl('https://example.test/health').protocol, 'https:');
  assert.throws(() => parseBackendHealthUrl('file:///tmp/health'), /must use http or https/);
  assert.throws(
    () => parseBackendHealthUrl('http://user:secret@127.0.0.1:3000/api/health'),
    /must not contain credentials/,
  );
  assert.throws(() => parseBackendHealthUrl('not a url'), /must be a valid URL/);
});
