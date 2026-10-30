import { randomUUID } from 'node:crypto';

/**
 * Compare-and-delete: only the holder that wrote the token may release the
 * lock, so a run whose lock already expired can never free a newer holder's.
 */
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

/** The subset of the ioredis client the lock needs (keeps callers easy to fake). */
export interface RedisLockClient {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttlSeconds: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}

export interface RedisLock {
  readonly key: string;
  /** Opaque owner token written to Redis; never logged. */
  readonly token: string;
  /**
   * Releases the lock if this holder still owns it. Resolves `false` when the
   * lock had already expired or been taken over, and rejects if Redis fails
   * (the lock then simply expires at its TTL).
   */
  release(): Promise<boolean>;
}

/**
 * Single-flight lock for scheduled jobs that every backend replica fires at
 * the same instant: `SET key token NX EX ttl`.
 *
 * Resolves `null` when another holder owns the lock. Always pass a TTL that
 * comfortably exceeds the job's worst-case run time but is shorter than the
 * schedule interval, so a crashed holder can never block the next run.
 */
export async function acquireRedisLock(
  redis: RedisLockClient,
  key: string,
  ttlSeconds: number,
): Promise<RedisLock | null> {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('Redis lock TTL must be a positive integer');
  }

  const token = randomUUID();
  const reply = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
  if (reply !== 'OK') {
    return null;
  }

  return {
    key,
    token,
    release: async () => {
      const deleted = await redis.eval(RELEASE_SCRIPT, 1, key, token);
      return deleted === 1;
    },
  };
}
