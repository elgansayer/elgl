import { acquireRedisLock, RedisLockClient } from './redis-lock';

/**
 * Minimal in-memory model of the two Redis commands the lock relies on, so the
 * single-flight guarantees can be exercised without a Redis server. `eval`
 * mirrors the compare-and-delete release script.
 */
class FakeRedis implements RedisLockClient {
  readonly store = new Map<string, string>();
  readonly scripts: string[] = [];

  set(
    key: string,
    value: string,
    _expiryMode: 'EX',
    _ttlSeconds: number,
    _setMode: 'NX',
  ): Promise<'OK' | null> {
    if (this.store.has(key)) {
      return Promise.resolve(null);
    }
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  eval(script: string, _numKeys: number, ...args: string[]): Promise<unknown> {
    this.scripts.push(script);
    const [key, token] = args;
    if (this.store.get(key) === token) {
      this.store.delete(key);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

describe('acquireRedisLock', () => {
  it('acquires the lock with SET NX EX and an unguessable owner token', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn(),
    };

    const lock = await acquireRedisLock(redis, 'jobs:example:lock', 3600);

    expect(lock).not.toBeNull();
    expect(redis.set).toHaveBeenCalledWith(
      'jobs:example:lock',
      lock?.token,
      'EX',
      3600,
      'NX',
    );
    expect(lock?.key).toBe('jobs:example:lock');
    expect(lock?.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns null without touching the key when another holder owns the lock', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
      eval: vi.fn(),
    };

    await expect(
      acquireRedisLock(redis, 'jobs:example:lock', 60),
    ).resolves.toBeNull();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the invalid TTL %s before talking to Redis',
    async (ttl) => {
      const redis = { set: vi.fn(), eval: vi.fn() };

      await expect(
        acquireRedisLock(redis, 'jobs:example:lock', ttl),
      ).rejects.toThrow(RangeError);
      expect(redis.set).not.toHaveBeenCalled();
    },
  );

  it('propagates Redis failures so callers can treat the job as failed', async () => {
    const redis = {
      set: vi.fn().mockRejectedValue(new Error('Connection is closed.')),
      eval: vi.fn(),
    };

    await expect(
      acquireRedisLock(redis, 'jobs:example:lock', 60),
    ).rejects.toThrow('Connection is closed.');
  });

  it('releases through a key-scoped compare-and-delete script', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    };
    const lock = await acquireRedisLock(redis, 'jobs:example:lock', 60);

    await expect(lock?.release()).resolves.toBe(true);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, token] = redis.eval.mock.calls[0] as [
      string,
      number,
      string,
      string,
    ];
    expect(numKeys).toBe(1);
    expect(key).toBe('jobs:example:lock');
    expect(token).toBe(lock?.token);
    expect(script).toContain("redis.call('get', KEYS[1]) == ARGV[1]");
    expect(script).toContain("redis.call('del', KEYS[1])");
  });

  it('reports false when the lock had already expired or changed hands', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(0),
    };
    const lock = await acquireRedisLock(redis, 'jobs:example:lock', 60);

    await expect(lock?.release()).resolves.toBe(false);
  });

  it('rejects release when Redis fails so the caller can log that TTL expiry applies', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockRejectedValue(new Error('Connection is closed.')),
    };
    const lock = await acquireRedisLock(redis, 'jobs:example:lock', 60);

    await expect(lock?.release()).rejects.toThrow('Connection is closed.');
  });

  describe('against a Redis model', () => {
    it('lets exactly one of several simultaneous replicas run', async () => {
      const redis = new FakeRedis();

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          acquireRedisLock(redis, 'jobs:example:lock', 60),
        ),
      );

      expect(results.filter((lock) => lock !== null)).toHaveLength(1);
    });

    it('lets the next run start once the holder has released', async () => {
      const redis = new FakeRedis();
      const first = await acquireRedisLock(redis, 'jobs:example:lock', 60);
      await first?.release();

      const second = await acquireRedisLock(redis, 'jobs:example:lock', 60);

      expect(second).not.toBeNull();
      expect(second?.token).not.toBe(first?.token);
    });

    it('never lets a stale holder release a newer holder lock', async () => {
      const redis = new FakeRedis();
      const stale = await acquireRedisLock(redis, 'jobs:example:lock', 60);
      // Simulate the stale holder's TTL expiring and a new replica taking over.
      redis.store.delete('jobs:example:lock');
      const current = await acquireRedisLock(redis, 'jobs:example:lock', 60);

      await expect(stale?.release()).resolves.toBe(false);

      expect(redis.store.get('jobs:example:lock')).toBe(current?.token);
      await expect(
        acquireRedisLock(redis, 'jobs:example:lock', 60),
      ).resolves.toBeNull();
    });
  });
});
