import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

export interface PersonalChatKeyResult {
  e2eeKey: string;
  roomId: string;
  algorithm: string;
}

interface StoredChatKeySession {
  key: string;
  participants: string[];
}

const CHAT_KEY_SESSION_PREFIX = 'chat:e2ee:';
const CHAT_KEY_SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const ROOM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_256_BIT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function isStoredChatKeySession(
  value: unknown,
  participants: string[],
): value is StoredChatKeySession {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('key' in value) ||
    !('participants' in value)
  ) {
    return false;
  }

  const key = value.key;
  const storedParticipants = value.participants;
  return (
    typeof key === 'string' &&
    BASE64URL_256_BIT_KEY_PATTERN.test(key) &&
    Array.isArray(storedParticipants) &&
    storedParticipants.length === participants.length &&
    storedParticipants.every(
      (participant, index) => participant === participants[index],
    )
  );
}

/**
 * Brokers authenticated content-encryption key material for personal
 * two-participant direct chat rooms outside the message plane. The application
 * API remains inside the trust boundary because it derives and distributes the
 * symmetric room key.
 *
 * Keys are derived deterministically per direct conversation using HMAC-SHA256
 * over sorted participant identifiers and the room identifier, cached in Redis,
 * and returned strictly to authenticated members of that specific direct room.
 */
@Injectable()
export class PersonalChatEncryptionService {
  private readonly logger = new Logger(PersonalChatEncryptionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves or brokers the 256-bit AES-GCM conversation key for a personal direct chat room.
   */
  async getConversationKey(
    roomId: string,
    userId: string,
  ): Promise<PersonalChatKeyResult> {
    this.assertRoomIdentifier(roomId);

    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('A valid user identifier is required.');
    }

    const supabase = this.supabaseService.getClient();

    // Verify room existence and ensure it is a direct personal conversation
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id, type, admin_id')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      this.logger.error('chat.e2ee.room_validation_failed');
      throw new ServiceUnavailableException(
        'Chat encryption service is temporarily unavailable.',
      );
    }

    if (!room) {
      throw new NotFoundException('Chat room not found.');
    }

    // Fetch members of this room
    const { data: members, error: membersError } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId);

    if (membersError) {
      this.logger.error('chat.e2ee.membership_validation_failed');
      throw new ServiceUnavailableException(
        'Chat encryption service is temporarily unavailable.',
      );
    }

    const memberIds = (members ?? []).map(
      (m: { user_id: string }) => m.user_id,
    );

    // Authorisation is checked before disclosing the room type and against the
    // database on every request. Cached participant lists must never outlive a
    // membership change.
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException(
        'You are not authorized to access key material for this conversation.',
      );
    }

    // Direct rooms must not have an admin_id (which designates group rooms).
    // Keep this status distinct from authorisation failures so clients never
    // interpret a forbidden direct-room request as permission to send plaintext.
    if (room.admin_id != null || (room.type && room.type !== 'direct')) {
      throw new UnprocessableEntityException(
        'Encrypted key brokering is restricted to personal direct chats.',
      );
    }

    // Personal chat rooms must have exactly two members.
    if (memberIds.length !== 2) {
      throw new ForbiddenException(
        'Encrypted personal chats require exactly two participants.',
      );
    }

    const sortedParticipants = [...memberIds].sort();

    // Read the cached key only after current membership has been verified.
    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(`${CHAT_KEY_SESSION_PREFIX}${roomId}`);
      if (cached) {
        const session: unknown = JSON.parse(cached);
        if (isStoredChatKeySession(session, sortedParticipants)) {
          return {
            e2eeKey: session.key,
            roomId,
            algorithm: 'AES-GCM-256',
          };
        }
      }
    } catch {
      this.logger.warn('chat.e2ee.cache_lookup_failed');
    }

    // Derive deterministic 256-bit key from sorted participants and room identifier.
    // There is deliberately no fallback to another credential or a literal value.
    const secret = this.configService
      .get<string>('CHAT_E2EE_MASTER_SECRET')
      ?.trim();
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      this.logger.error('chat.e2ee.master_secret_unavailable');
      throw new ServiceUnavailableException(
        'Chat encryption service is temporarily unavailable.',
      );
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(
      `personal-message-e2ee:${sortedParticipants[0]}:${sortedParticipants[1]}:${roomId}`,
    );
    const e2eeKey = hmac.digest('base64url');

    // Cache the derived key in Redis for high-performance retrieval
    try {
      const redis = this.supabaseService.getRedisClient();
      const sessionData: StoredChatKeySession = {
        key: e2eeKey,
        participants: sortedParticipants,
      };
      await redis.setex(
        `${CHAT_KEY_SESSION_PREFIX}${roomId}`,
        CHAT_KEY_SESSION_TTL_SECONDS,
        JSON.stringify(sessionData),
      );
    } catch {
      this.logger.warn('chat.e2ee.cache_write_failed');
    }

    return {
      e2eeKey,
      roomId,
      algorithm: 'AES-GCM-256',
    };
  }

  private assertRoomIdentifier(roomId: string): void {
    if (
      !roomId ||
      typeof roomId !== 'string' ||
      !ROOM_UUID_PATTERN.test(roomId)
    ) {
      throw new BadRequestException('Invalid chat room identifier format.');
    }
  }
}
