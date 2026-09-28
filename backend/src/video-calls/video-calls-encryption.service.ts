import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

interface StoredEncryptionSession {
  key: string;
  participants: string[];
}

const CALL_SESSION_PREFIX = 'video-calls:e2ee:';
const CALL_SESSION_TTL_SECONDS = 60 * 60;
const ROOM_NAME_PATTERN =
  /^video_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Brokers short-lived LiveKit E2EE material outside the media plane.
 *
 * Keys are generated with CSPRNG entropy, stored only in Redis for the
 * lifetime of the call token, and are never written to logs or durable
 * application tables. LiveKit receives encrypted media and never receives
 * this key.
 */
@Injectable()
export class VideoCallsEncryptionService {
  private readonly logger = new Logger(VideoCallsEncryptionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createSession(
    roomName: string,
    callerId: string,
    remoteUserId: string,
  ): Promise<string> {
    this.assertRoomName(roomName);
    if (!callerId || !remoteUserId || callerId === remoteUserId) {
      throw new BadRequestException('A different call participant is required');
    }

    const key = randomBytes(32).toString('base64url');
    const session: StoredEncryptionSession = {
      key,
      participants: [callerId, remoteUserId],
    };

    try {
      const redis = this.supabaseService.getRedisClient();
      await redis.setex(
        `${CALL_SESSION_PREFIX}${roomName}`,
        CALL_SESSION_TTL_SECONDS,
        JSON.stringify(session),
      );
    } catch {
      this.logger.error('Unable to persist encrypted call session');
      throw new ServiceUnavailableException(
        'Encrypted calls are temporarily unavailable',
      );
    }

    return key;
  }

  async getKeyForParticipant(
    roomName: string,
    userId: string,
  ): Promise<string> {
    this.assertRoomName(roomName);

    let raw: string | null;
    try {
      raw = await this.supabaseService
        .getRedisClient()
        .get(`${CALL_SESSION_PREFIX}${roomName}`);
    } catch {
      this.logger.error('Unable to read encrypted call session');
      throw new ServiceUnavailableException(
        'Encrypted calls are temporarily unavailable',
      );
    }

    if (!raw) {
      throw new ForbiddenException('Call is unavailable');
    }

    let session: StoredEncryptionSession;
    try {
      session = JSON.parse(raw) as StoredEncryptionSession;
    } catch {
      this.logger.error('Encrypted call session could not be decoded');
      throw new ServiceUnavailableException(
        'Encrypted calls are temporarily unavailable',
      );
    }

    if (
      typeof session.key !== 'string' ||
      session.key.length < 32 ||
      !Array.isArray(session.participants) ||
      !session.participants.every(
        (participant) => typeof participant === 'string',
      )
    ) {
      this.logger.error('Encrypted call session failed integrity validation');
      throw new ServiceUnavailableException(
        'Encrypted calls are temporarily unavailable',
      );
    }

    if (!session.participants.includes(userId)) {
      throw new ForbiddenException('Call is unavailable');
    }

    return session.key;
  }

  private assertRoomName(roomName: string): void {
    if (!ROOM_NAME_PATTERN.test(roomName)) {
      throw new BadRequestException('Invalid call room');
    }
  }
}
