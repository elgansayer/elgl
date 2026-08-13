import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CentrifugoService } from '../centrifugo.service';
import { ChatMessage } from '../interfaces/chat-message.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class SystemMessageService {
  constructor(
    private readonly centrifugoService: CentrifugoService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private buildMessage(
    roomId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): ChatMessage {
    return {
      id: `sys_${Date.now()}_${randomUUID()}`,
      room_id: roomId,
      sender_id: '',
      message_type: 'system',
      system_event: { type: eventType, ...params },
      is_read: false,
      created_at: new Date().toISOString(),
    };
  }

  async publishToRoom(
    roomId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const message = this.buildMessage(roomId, eventType, params);
    await this.centrifugoService.publish(`chat:${roomId}`, { message });
  }

  /**
   * Publishes a system event to all chat rooms the given user is a member of.
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
      Logger.warn(`Failed to fetch rooms for user ${userId}: ${error.message}`);
      return;
    }

    const roomIds: string[] = (memberships ?? []).map(
      (m: { room_id: string }) => m.room_id,
    );

    const publishPromises = roomIds.map((roomId) =>
      this.publishToRoom(roomId, eventType, params),
    );

    await Promise.allSettled(publishPromises);
  }

  /**
   * Finds a 1-on-1 chat room between two users and publishes a system event.
   * Falls back to publishing to the recipient's notification channel if no room found.
   */
  async publishToDirectRoom(
    userA: string,
    userB: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: roomsA } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userA);

    const roomIdsA = (roomsA ?? []).map((r: { room_id: string }) => r.room_id);
    if (roomIdsA.length === 0) return;

    const { data: mutualRooms } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userB)
      .in('room_id', roomIdsA);

    if (!mutualRooms || mutualRooms.length === 0) return;

    const mutualRoomIds = mutualRooms.map((r) => r.room_id);

    // Get member counts for all mutual rooms in one batch query
    const countPromises = mutualRoomIds.map((candidateRoomId) =>
      supabase
        .from('chat_room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', candidateRoomId),
    );

    const countResults = await Promise.all(countPromises);

    // Find the 1-on-1 room (exactly 2 members)
    for (let i = 0; i < mutualRooms.length; i++) {
      const candidateRoomId = mutualRooms[i].room_id;
      const { count } = countResults[i];

      if (count === 2) {
        await this.publishToRoom(candidateRoomId, eventType, params);
        return;
      }
    }
  }
}
