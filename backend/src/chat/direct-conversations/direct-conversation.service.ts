import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SafetyService } from '../../safety/safety.service';
import { SupabaseService } from '../../supabase/supabase.service';

interface DirectRoomRow {
  id: string;
  admin_id?: string | null;
}

interface RoomMembershipRow {
  room_id: string;
  user_id?: string;
}

@Injectable()
export class DirectConversationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async openOrCreate(userId: string, targetUserId: string): Promise<string> {
    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    const blockedUserIds =
      await this.safetyService.getBlockedAndBlockerIds(userId);
    if (blockedUserIds.includes(targetUserId)) {
      throw new ForbiddenException('You cannot message this user');
    }

    const supabase = this.supabaseService.getClient();
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, is_deletion_pending')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError) {
      throw new Error(
        `Failed to validate conversation target: ${targetError.message}`,
      );
    }
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.is_deletion_pending) {
      throw new ForbiddenException('This user is not available for messaging');
    }

    const existingRoomId = await this.findExistingDirectRoom(
      userId,
      targetUserId,
    );
    if (existingRoomId) return existingRoomId;

    const roomId = this.directRoomId(userId, targetUserId);
    const { error: roomError } = await supabase.from('chat_rooms').upsert(
      {
        id: roomId,
        title: 'Direct message',
        subtitle: '',
        avatar: '',
        is_online: false,
        is_pinned: false,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );

    if (roomError) {
      throw new Error(
        `Failed to create direct conversation: ${roomError.message}`,
      );
    }

    const { error: memberError } = await supabase
      .from('chat_room_members')
      .upsert(
        [userId, targetUserId].map((memberId) => ({
          room_id: roomId,
          user_id: memberId,
        })),
        { onConflict: 'room_id,user_id', ignoreDuplicates: true },
      );

    if (memberError) {
      throw new Error(
        `Failed to add conversation members: ${memberError.message}`,
      );
    }

    return roomId;
  }

  private async findExistingDirectRoom(
    userId: string,
    targetUserId: string,
  ): Promise<string | undefined> {
    const supabase = this.supabaseService.getClient();
    const { data: myMemberships, error: myRoomsError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    if (myRoomsError) {
      throw new Error(`Failed to load conversations: ${myRoomsError.message}`);
    }

    const myRoomIds = (myMemberships ?? []).map(
      (membership: RoomMembershipRow) => membership.room_id,
    );
    if (myRoomIds.length === 0) return undefined;

    const { data: mutualMemberships, error: mutualError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', targetUserId)
      .in('room_id', myRoomIds);

    if (mutualError) {
      throw new Error(
        `Failed to load mutual conversations: ${mutualError.message}`,
      );
    }

    const mutualRoomIds = (mutualMemberships ?? []).map(
      (membership: RoomMembershipRow) => membership.room_id,
    );
    if (mutualRoomIds.length === 0) return undefined;

    const { data: directRooms, error: directRoomsError } = await supabase
      .from('chat_rooms')
      .select('id, admin_id')
      .in('id', mutualRoomIds);

    if (directRoomsError) {
      throw new Error(
        `Failed to validate direct conversations: ${directRoomsError.message}`,
      );
    }

    const directRoomIds = new Set(
      (directRooms ?? [])
        .filter((room: DirectRoomRow) => room.admin_id == null)
        .map((room: DirectRoomRow) => room.id),
    );
    if (directRoomIds.size === 0) return undefined;

    const candidates = mutualRoomIds.filter((roomId) =>
      directRoomIds.has(roomId),
    );
    const { data: members, error: membersError } = await supabase
      .from('chat_room_members')
      .select('room_id, user_id')
      .in('room_id', candidates);

    if (membersError) {
      throw new Error(
        `Failed to validate conversation members: ${membersError.message}`,
      );
    }

    const roomCounts = new Map<string, number>();
    for (const member of members ?? []) {
      const row = member as RoomMembershipRow;
      roomCounts.set(row.room_id, (roomCounts.get(row.room_id) ?? 0) + 1);
    }

    return candidates.find((roomId) => roomCounts.get(roomId) === 2);
  }

  private directRoomId(userId: string, targetUserId: string): string {
    const key = [userId, targetUserId].sort().join(':');
    const bytes = createHash('sha256')
      .update(`direct:${key}`)
      .digest()
      .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
