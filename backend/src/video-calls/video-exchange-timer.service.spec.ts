import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  VideoExchangeTimerService,
  ExchangeTimerStatus,
} from './video-exchange-timer.service';

const ROOM_NAME = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const CALLER_ID = '11111111-1111-4111-8111-111111111111';
const REMOTE_ID = '22222222-2222-4222-8222-222222222222';

interface FakeMulti {
  set(key: string, value: string, mode: string, ttl: number): FakeMulti;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

class FakeRedis {
  readonly store = new Map<string, string>();
  failGet = false;
  conflictOnce = false;
  setex = vi.fn((key: string, _ttl: number, value: string) => {
    this.store.set(key, value);
    return Promise.resolve('OK');
  });
  get = vi.fn((key: string) => {
    if (this.failGet) return Promise.reject(new Error('redis unavailable'));
    return Promise.resolve(this.store.get(key) ?? null);
  });
  watch = vi.fn(() => Promise.resolve('OK'));
  unwatch = vi.fn(() => Promise.resolve('OK'));

  multi(): FakeMulti {
    const operations: Array<() => void> = [];
    const chain: FakeMulti = {
      set: (key: string, value: string, _mode: string, _ttl: number) => {
        operations.push(() => this.store.set(key, value));
        return chain;
      },
      exec: () => {
        if (this.conflictOnce) {
          this.conflictOnce = false;
          return Promise.resolve(null);
        }
        operations.forEach((operation) => operation());
        return Promise.resolve(operations.map(() => [null, 'OK']));
      },
    };
    return chain;
  }

  session(): Record<string, unknown> | null {
    const raw = this.store.get(`video-calls:exchange:${ROOM_NAME}`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }

  setSession(session: Record<string, unknown>): void {
    this.store.set(
      `video-calls:exchange:${ROOM_NAME}`,
      JSON.stringify(session),
    );
  }
}

function profile(
  id: string,
  nativeLanguages: string[],
  targetLanguages: string[],
) {
  return {
    id,
    native_languages: nativeLanguages,
    target_languages: targetLanguages,
  };
}

function buildService(
  redis: FakeRedis,
  options: {
    enabled?: string;
    durationSeconds?: string;
    profiles?: Array<Record<string, unknown>>;
  } = {},
): VideoExchangeTimerService {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'EXCHANGE_TIMERS_ENABLED') return options.enabled;
      if (key === 'EXCHANGE_TURN_DURATION_SECONDS')
        return options.durationSeconds ?? '300';
      return undefined;
    }),
  };
  const supabase = {
    getRedisClient: vi.fn().mockReturnValue(redis),
    getClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: options.profiles ?? [
              profile(CALLER_ID, ['en'], ['es']),
              profile(REMOTE_ID, ['es'], ['en']),
            ],
            error: null,
          }),
        }),
      }),
    }),
  };

  return new VideoExchangeTimerService(
    config as unknown as ConfigService,
    supabase as unknown as SupabaseService,
  );
}

async function startAndJoin(service: VideoExchangeTimerService): Promise<void> {
  await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);
  await service.markParticipantJoined(ROOM_NAME, CALLER_ID);
  await service.markParticipantJoined(ROOM_NAME, REMOTE_ID);
}

describe('VideoExchangeTimerService', () => {
  let redis: FakeRedis;
  let service: VideoExchangeTimerService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = buildService(redis);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stores a reciprocal language pair for the call', async () => {
    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);

    const session = redis.session();
    expect(session).toEqual(
      expect.objectContaining({
        reciprocal: true,
        turnDurationSeconds: 300,
        turnIndex: 0,
        turnStartedAt: null,
      }),
    );
    const participants = session?.participants as Array<
      Record<string, unknown>
    >;
    expect(participants[0]).toEqual(
      expect.objectContaining({ userId: CALLER_ID, language: 'en' }),
    );
    expect(participants[1]).toEqual(
      expect.objectContaining({ userId: REMOTE_ID, language: 'es' }),
    );
  });

  it('falls back to native languages when the pair is not reciprocal', async () => {
    service = buildService(redis, {
      profiles: [
        profile(CALLER_ID, ['en'], ['fr']),
        profile(REMOTE_ID, ['de'], ['it']),
      ],
    });

    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);

    const session = redis.session();
    expect(session?.reciprocal).toBe(false);
    const participants = session?.participants as Array<
      Record<string, unknown>
    >;
    expect(participants[0].language).toBe('en');
    expect(participants[1].language).toBe('de');
  });

  it('waits for both participants before starting the first turn', async () => {
    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);

    const waiting = await service.getStatus(ROOM_NAME, CALLER_ID);
    expect(waiting.active).toBe(false);
    expect(waiting.waitingForParticipant).toBe(true);

    await service.markParticipantJoined(ROOM_NAME, CALLER_ID);
    const stillWaiting = await service.getStatus(ROOM_NAME, CALLER_ID);
    expect(stillWaiting.active).toBe(false);

    await service.markParticipantJoined(ROOM_NAME, REMOTE_ID);
    const active = await service.getStatus(ROOM_NAME, CALLER_ID);
    expect(active.active).toBe(true);
    expect(active.waitingForParticipant).toBe(false);
    expect(active.currentSpeakerId).toBe(CALLER_ID);
    expect(active.currentSpeakerLanguage).toBe('en');
    expect(active.isCurrentSpeaker).toBe(true);
    expect(active.remainingSeconds).toBe(300);
  });

  it('alternates speakers automatically when a turn elapses', async () => {
    await startAndJoin(service);

    vi.setSystemTime(new Date('2026-11-10T12:05:05.000Z'));
    const status = await service.getStatus(ROOM_NAME, CALLER_ID);

    expect(status.turnIndex).toBe(1);
    expect(status.currentSpeakerId).toBe(REMOTE_ID);
    expect(status.currentSpeakerLanguage).toBe('es');
    expect(status.isCurrentSpeaker).toBe(false);
    expect(status.remainingSeconds).toBe(295);
    expect(status.participants[0].turnsTaken).toBe(1);
  });

  it('lets the current speaker end the turn early', async () => {
    await startAndJoin(service);

    const status = await service.advanceTurn(ROOM_NAME, CALLER_ID, 0);

    expect(status.turnIndex).toBe(1);
    expect(status.currentSpeakerId).toBe(REMOTE_ID);
    expect(status.isCurrentSpeaker).toBe(false);
    expect(status.participants[0].turnsTaken).toBe(1);
  });

  it('treats a stale expected turn index as an idempotent retry', async () => {
    await startAndJoin(service);

    const first = await service.advanceTurn(ROOM_NAME, CALLER_ID, 0);
    const retried = await service.advanceTurn(ROOM_NAME, CALLER_ID, 0);

    expect(first.turnIndex).toBe(1);
    expect(retried.turnIndex).toBe(1);
    expect(retried.participants[0].turnsTaken).toBe(1);
  });

  it('rejects an advance from a participant who is not the current speaker', async () => {
    await startAndJoin(service);

    await expect(service.advanceTurn(ROOM_NAME, REMOTE_ID, 0)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a future turn index', async () => {
    await startAndJoin(service);

    await expect(service.advanceTurn(ROOM_NAME, CALLER_ID, 3)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an advance before both participants have joined', async () => {
    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);

    await expect(service.advanceTurn(ROOM_NAME, CALLER_ID, 0)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not expose timer state to a non-participant', async () => {
    await startAndJoin(service);

    await expect(
      service.getStatus(ROOM_NAME, '99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns inactive state when no session exists', async () => {
    const status = await service.getStatus(ROOM_NAME, CALLER_ID);

    expect(status.active).toBe(false);
    expect(status.participants).toEqual([]);
  });

  it('retries a conflicting concurrent update', async () => {
    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);
    redis.conflictOnce = true;

    await service.markParticipantJoined(ROOM_NAME, CALLER_ID);

    expect(redis.watch).toHaveBeenCalledTimes(2);
    const session = redis.session();
    expect(session?.joinedParticipantIds).toEqual([CALLER_ID]);
  });

  it('returns inactive state and skips persistence when disabled', async () => {
    service = buildService(redis, { enabled: 'false' });

    await service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID);
    const status: ExchangeTimerStatus = await service.getStatus(
      ROOM_NAME,
      CALLER_ID,
    );

    expect(redis.setex).not.toHaveBeenCalled();
    expect(status.active).toBe(false);
  });

  it('does not block call start when Redis cannot persist the session', async () => {
    redis.setex.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(
      service.startSession(ROOM_NAME, CALLER_ID, REMOTE_ID),
    ).resolves.toBeUndefined();
  });

  it('surfaces a temporary outage when reading timer state fails', async () => {
    redis.failGet = true;

    await expect(service.getStatus(ROOM_NAME, CALLER_ID)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects malformed room names', async () => {
    await expect(
      service.getStatus('not-a-call-room', CALLER_ID),
    ).rejects.toThrow(BadRequestException);
  });
});
