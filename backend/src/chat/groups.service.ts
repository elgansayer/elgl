import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SystemMessageService } from './services/system-message.service';
import { ChatRoomRecord } from './interfaces/chat-message.interface';
import { randomBytes } from 'crypto';

export interface GroupMember {
  user_id: string;
  user: {
    id: string;
    display_name: string | null | undefined;
    avatar_url: string | null | undefined;
  } | null;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly systemMessageService: SystemMessageService,
    private readonly configService: ConfigService,
  ) {}

  private async verifyAdmin(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('admin_id')
      .eq('id', roomId)
      .single();
    if (!room || room.admin_id !== userId) {
      throw new ForbiddenException('Only group admins can perform this action');
    }
  }

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
  ): Promise<ChatRoomRecord> {
    if (memberIds.length > 49) {
      throw new Error('Group cannot exceed 50 members');
    }
    const supabase = this.supabaseService.getClient();

    const response = await supabase
      .from('chat_rooms')
      .insert({
        title: name,
        is_online: true,
        is_pinned: false,
        admin_id: creatorId,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error('Failed to create group');
    }

    const room = response.data as ChatRoomRecord;

    const allMembers = [...new Set([creatorId, ...memberIds])];
    const membersData = allMembers.map((id) => ({
      room_id: room.id,
      user_id: id,
    }));

    const { error: membersError } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (membersError) {
      throw new Error('Failed to add members to group');
    }

    return room;
  }

  async renameGroup(
    userId: string,
    roomId: string,
    newName: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('chat_rooms')
      .update({ title: newName })
      .eq('id', roomId);

    if (error) throw new Error('Failed to rename group');

    await this.systemMessageService.publishToRoom(roomId, 'groupRenamed', {
      name: newName,
    });
  }

  async addGroupMembers(
    userId: string,
    roomId: string,
    memberIds: string[],
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const membersData = memberIds.map((id) => ({
      room_id: roomId,
      user_id: id,
    }));

    const { error } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (error) throw new Error('Failed to add members');

    await this.systemMessageService.publishToRoom(roomId, 'memberAdded', {
      count: memberIds.length,
    });
  }

  async removeGroupMember(
    userId: string,
    roomId: string,
    memberId: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .match({ room_id: roomId, user_id: memberId });

    if (error) throw new Error('Failed to remove member');

    await this.systemMessageService.publishToRoom(roomId, 'memberRemoved', {});
  }

  async getGroupMembers(roomId: string): Promise<GroupMember[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select(
        `
        user_id,
        user:users!chat_room_members_user_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId);

    if (error) throw new Error('Failed to fetch group members');
    return data ?? [];
  }

  async generateInviteCode(userId: string, roomId: string): Promise<string> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const code = randomBytes(6).toString('hex');
    const { error } = await supabase
      .from('chat_rooms')
      .update({ invite_code: code })
      .eq('id', roomId);
    if (error)
      throw new InternalServerErrorException('Failed to generate invite code');
    return code;
  }

  async generateInviteLink(
    userId: string,
    roomId: string,
  ): Promise<{ code: string; url: string }> {
    const code = await this.generateInviteCode(userId, roomId);
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    const url = `${baseUrl}/join/${code}`;
    return { code, url };
  }

  async getInviteInfo(
    code: string,
  ): Promise<{ roomId: string; title: string }> {
    const supabase = this.supabaseService.getClient();
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('id, title, max_members')
      .eq('invite_code', code)
      .maybeSingle();
    if (error || !room) {
      throw new NotFoundException('Invalid or expired invite link');
    }

    const roomData = room as unknown as {
      id: string;
      title: string;
      max_members: number;
    };

    // Check if the group is full
    const { count: memberCount } = await supabase
      .from('chat_room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomData.id);

    if (memberCount !== null && memberCount >= roomData.max_members) {
      throw new ForbiddenException('Group is full');
    }
    return { roomId: roomData.id, title: roomData.title };
  }

  async joinByInviteCode(userId: string, code: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: room, error: roomErr } = await supabase
      .from('chat_rooms')
      .select('id, title, max_members')
      .eq('invite_code', code)
      .single();
    if (roomErr || !room) {
      throw new NotFoundException('Invalid or expired invite code');
    }

    const roomData = room as unknown as {
      id: string;
      title: string;
      max_members: number;
    };

    // Check if the group is full
    const { count: memberCount } = await supabase
      .from('chat_room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomData.id);

    if (memberCount !== null && memberCount >= roomData.max_members) {
      throw new ForbiddenException('Group is full');
    }
    const roomId = roomData.id;

    const { data: member } = await supabase
      .from('chat_room_members')
      .select('id')
      .match({ room_id: roomId, user_id: userId })
      .maybeSingle();
    if (member)
      throw new ConflictException('You are already a member of this group');

    const { error: insertErr } = await supabase
      .from('chat_room_members')
      .insert({ room_id: roomId, user_id: userId });
    if (insertErr)
      throw new InternalServerErrorException('Failed to join group');

    await this.systemMessageService.publishToRoom(roomId, 'memberAdded', {
      count: 1,
    });
  }

  async createAnnouncementGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
  ): Promise<ChatRoomRecord> {
    if (memberIds.length > 49) {
      throw new Error('Group cannot exceed 50 members');
    }
    const supabase = this.supabaseService.getClient();

    const response = await supabase
      .from('chat_rooms')
      .insert({
        title: name,
        is_announcement: true,
        admin_id: creatorId,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error('Failed to create announcement group');
    }

    const room = response.data as ChatRoomRecord;

    const allMembers = [...new Set([creatorId, ...memberIds])];
    const membersData = allMembers.map((id) => ({
      room_id: room.id,
      user_id: id,
    }));

    const { error: membersError } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (membersError) {
      throw new Error('Failed to add members to announcement group');
    }

    return room;
  }

  async sendAnnouncement(
    userId: string,
    roomId: string,
    message: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('chat_room_announcements').insert({
      room_id: roomId,
      admin_id: userId,
      message,
    });
    if (error) {
      throw new InternalServerErrorException('Failed to send announcement');
    }
    await this.systemMessageService.publishToRoom(roomId, 'announcement', {
      message,
    });
  }

  async getAnnouncements(
    roomId: string,
  ): Promise<
    Array<{ id: string; message: string; createdAt: string; senderId: string }>
  > {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_announcements')
      .select('id, message, created_at, admin_id')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch announcements');
    }

    const rows = (data ?? []) as Array<{
      id: string;
      message: string;
      created_at: string;
      admin_id: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      createdAt: row.created_at,
      senderId: row.admin_id,
    }));
  }
}
