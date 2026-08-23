import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { VideoCallsEncryptionService } from './video-calls-encryption.service';

const roomName = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const callerId = '11111111-1111-4111-8111-111111111111';
const remoteUserId = '22222222-2222-4222-8222-222222222222';

describe('VideoCallsEncryptionService', () => {
  let service: VideoCallsEncryptionService;
  const redis = {
    setex: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(async () => {
    redis.setex.mockReset().mockResolvedValue('OK');
    redis.get.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsEncryptionService,
        {
          provide: SupabaseService,
          useValue: { getRedisClient: () => redis },
        },
      ],
    }).compile();

    service = module.get(VideoCallsEncryptionService);
  });

  it('stores a 256-bit room key with a one-hour TTL and two-person allowlist', async () => {
    const key = await service.createSession(roomName, callerId, remoteUserId);

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [redisKey, ttl, rawSession] = redis.setex.mock.calls[0];
    expect(redisKey).toBe(`video-calls:e2ee:${roomName}`);
    expect(ttl).toBe(3600);
    expect(JSON.parse(rawSession)).toEqual({
      key,
      participants: [callerId, remoteUserId],
    });
  });

  it('refuses self-calls before generating a session', async () => {
    await expect(service.createSession(roomName, callerId, callerId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('returns the same key only to an intended participant', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        key: 'A'.repeat(43),
        participants: [callerId, remoteUserId],
      }),
    );

    await expect(service.getKeyForParticipant(roomName, remoteUserId)).resolves.toBe(
      'A'.repeat(43),
    );
  });

  it('does not reveal whether a room exists to a non-participant', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        key: 'A'.repeat(43),
        participants: [callerId, remoteUserId],
      }),
    );

    await expect(
      service.getKeyForParticipant(
        roomName,
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when the room session expired', async () => {
    redis.get.mockResolvedValue(null);

    await expect(
      service.getKeyForParticipant(roomName, remoteUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when Redis is unavailable or stored data is corrupted', async () => {
    redis.get.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      service.getKeyForParticipant(roomName, remoteUserId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    redis.get.mockResolvedValueOnce('{broken');
    await expect(
      service.getKeyForParticipant(roomName, remoteUserId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects untrusted room identifiers before touching Redis', async () => {
    await expect(
      service.getKeyForParticipant('../other-key', remoteUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
