import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { CentrifugoService } from '../centrifugo.service';
import { ChatMessage } from '../interfaces/chat-message.interface';

const SYSTEM_EVENT_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SYSTEM_EVENT_PARAM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_SYSTEM_EVENT_PARAMS = 12;
const MAX_SYSTEM_EVENT_PARAM_LENGTH = 500;

type SystemEventParam = string | number | boolean | null;

@Injectable()
export class SystemMessageService {
  private readonly logger = new Logger(SystemMessageService.name);

  constructor(
    private readonly centrifugoService: CentrifugoService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private normalizeEventType(eventType: string): string {
    const normalized = eventType.trim();
    if (!SYSTEM_EVENT_TYPE_PATTERN.test(normalized)) {
      throw new Error('Invalid system event type');
    }
    return normalized;
  }

  private normalizeParams(params: Record<string, unknown>): Record<string, SystemEventParam> {
    const normalized: Record<string, SystemEventParam> = {};

    for (const [key, value] of Object.entries(params).slice(0, MAX_SYSTEM_EVENT_PARAMS)) {
      // `type` is reserved and is always assigned by the backend below.
      if (key === 'type' || !SYSTEM_EVENT_PARAM_KEY_PATTERN.test(key)) continue;

      if (typeof value === 'string') {
        normalized[key] = value.slice(0, MAX_SYSTEM_EVENT_PARAM_LENGTH);
      } else if (
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      ) {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private buildMessage(
    roomId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): ChatMessage {
    const normalizedEventType = this.normalizeEventType(eventType);
    const normalizedParams = this.normalizeParams(params);

    return {
      id: `sys_${Date.now()}_${randomUUID()}`,
      room_id: roomId,
      sender_id: '',
      message_type: 'system',
      // Keep the trusted event type last so params can never replace it.
      system_event: { ...normalizedParams, type: normalizedEventType },
      is_read: false,
      created_at: new Date().toISOString(),
    };
  }

  async publishToRoom(
    roomId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    if (!roomId.trim()) {
      throw new Error('System event room id is required');
    }

    const message = this.buildMessage(roomId, eventType, params);
    await this.centrifugoService.publish(`chat:${roomId}`, { message });
  }

  /**
   * Publishes a system event to every chat room the user belongs to.
   * Individual Centrifugo failures do not prevent delivery to other rooms.
   */
  async publishToAllUserRooms(
    userId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: memberships, error } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    if (error) {
      this.logger.warn('Unable to resolve rooms for system-event fan-out');
      return;
    }

    const roomIds = [
      ...new Set(
        (memberships ?? [])
          .map((membership: { room_id?: unknown }) => membership.room_id)
          .filter((roomId): roomId is string => typeof roomId === 'string' && roomId.length > 0),
      ),
    ];

    const results = await Promise.allSettled(
      roomIds.map((roomId) => this.publishToRoom(roomId, eventType, params)),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;

    if (failed > 0) {
      this.logger.warn(
        `System-event fan-out partially failed (${failed}/${roomIds.length} room publishes)`,
      );
    }
  }

  /**
   * Finds a 1-on-1 room shared by two users and publishes a system event.
   * Group rooms are deliberately excluded even when both users are members.
   */
  async publishToDirectRoom(
    userA: string,
    userB: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: roomsA, error: roomsAError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userA);

    if (roomsAError) {
      this.logger.warn('Unable to resolve source memberships for direct system event');
      return;
    }

    const roomIdsA = [
      ...new Set(
        (roomsA ?? [])
          .map((room: { room_id?: unknown }) => room.room_id)
          .filter((roomId): roomId is string => typeof roomId === 'string' && roomId.length > 0),
      ),
    ];
    if (roomIdsA.length === 0) return;

    const { data: mutualRooms, error: mutualRoomsError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userB)
      .in('room_id', roomIdsA);

    if (mutualRoomsError) {
      this.logger.warn('Unable to resolve mutual memberships for direct system event');
      return;
    }
    if (!mutualRooms || mutualRooms.length === 0) return;

    const candidateRoomIds = [
      ...new Set(
        mutualRooms
          .map((room: { room_id?: unknown }) => room.room_id)
          .filter((roomId): roomId is string => typeof roomId === 'string' && roomId.length > 0),
      ),
    ];

    const { data: allMembers, error: membersError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .in('room_id', candidateRoomIds);

    if (membersError) {
      this.logger.warn('Unable to count memberships for direct system event');
      return;
    }
    if (!allMembers) return;

    const roomCounts = new Map<string, number>();
    for (const member of allMembers) {
      if (typeof member.room_id !== 'string') continue;
      roomCounts.set(member.room_id, (roomCounts.get(member.room_id) ?? 0) + 1);
    }

    const directRoomId = candidateRoomIds.find((roomId) => roomCounts.get(roomId) === 2);
    if (directRoomId) {
      await this.publishToRoom(directRoomId, eventType, params);
    }
  }
}
