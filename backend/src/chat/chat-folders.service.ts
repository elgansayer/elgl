import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatRoomRecord } from './interfaces/chat-message.interface';

const MAX_FOLDER_ROOMS = 200;
const ROOM_SELECT =
  'id, title, subtitle, avatar, is_online, is_pinned, created_at, admin_id, wallpaper_url, labels';

type MemberFolderField = 'is_archived' | 'is_locked';

@Injectable()
export class ChatFoldersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getArchivedRooms(userId: string): Promise<ChatRoomRecord[]> {
    return this.getRoomsForMemberFolder(userId, 'is_archived');
  }

  async getHiddenRooms(userId: string): Promise<ChatRoomRecord[]> {
    return this.getRoomsForMemberFolder(userId, 'is_locked');
  }

  async archiveRoom(userId: string, roomId: string): Promise<void> {
    await this.updateArchiveState(userId, roomId, true);
  }

  async unarchiveRoom(userId: string, roomId: string): Promise<void> {
    await this.updateArchiveState(userId, roomId, false);
  }

  private async updateArchiveState(
    userId: string,
    roomId: string,
    archived: boolean,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .update({ is_archived: archived })
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .select('room_id')
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException('Unable to update chat folder.');
    }
    if (!data) {
      // Do not disclose whether the room exists when the caller is not a member.
      throw new NotFoundException('Chat room not found.');
    }
  }

  private async getRoomsForMemberFolder(
    userId: string,
    field: MemberFolderField,
  ): Promise<ChatRoomRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data: memberships, error: membershipError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq(field, true)
      .limit(MAX_FOLDER_ROOMS);

    if (membershipError) {
      throw new ServiceUnavailableException('Unable to load chat folder.');
    }

    const roomIds = (memberships ?? [])
      .map((membership: { room_id?: string | null }) => membership.room_id)
      .filter((roomId): roomId is string => typeof roomId === 'string');

    if (roomIds.length === 0) {
      return [];
    }

    const { data: rooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select(ROOM_SELECT)
      .in('id', roomIds)
      .limit(MAX_FOLDER_ROOMS);

    if (roomsError) {
      throw new ServiceUnavailableException('Unable to load chat folder.');
    }

    const order = new Map(roomIds.map((id, index) => [id, index]));
    return ((rooms ?? []) as ChatRoomRecord[]).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }
}
