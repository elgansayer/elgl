import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const MAX_ARCHIVED_ROOMS = 500;

interface ArchiveMembershipRow {
  room_id: string;
  is_archived?: boolean | null;
}

@Injectable()
export class ChatArchiveService {
  private readonly logger = new Logger(ChatArchiveService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getArchivedRoomIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })
      .limit(MAX_ARCHIVED_ROOMS);

    if (error) {
      this.logger.warn('chat_archive_list_failed');
      throw new ServiceUnavailableException('Unable to load archived chats');
    }

    const roomIds = (data ?? [])
      .map((row: { room_id?: unknown }) => row.room_id)
      .filter((roomId): roomId is string => typeof roomId === 'string');

    return [...new Set(roomIds)].slice(0, MAX_ARCHIVED_ROOMS);
  }

  async archiveRoom(userId: string, roomId: string): Promise<void> {
    await this.setArchived(userId, roomId, true);
  }

  async unarchiveRoom(userId: string, roomId: string): Promise<void> {
    await this.setArchived(userId, roomId, false);
  }

  private async setArchived(
    userId: string,
    roomId: string,
    isArchived: boolean,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const membershipResponse = await supabase
      .from('chat_room_members')
      .select('room_id, is_archived')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipResponse.error) {
      this.logger.warn('chat_archive_membership_lookup_failed');
      throw new ServiceUnavailableException('Unable to update archived chat');
    }

    const membership = membershipResponse.data as ArchiveMembershipRow | null;
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (Boolean(membership.is_archived) === isArchived) {
      return;
    }

    const archivedAt = isArchived ? new Date().toISOString() : null;
    const updateResponse = await supabase
      .from('chat_room_members')
      .update({ is_archived: isArchived, archived_at: archivedAt })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select('room_id')
      .maybeSingle();

    if (updateResponse.error || !updateResponse.data) {
      this.logger.warn('chat_archive_update_failed');
      throw new ServiceUnavailableException('Unable to update archived chat');
    }
  }
}
