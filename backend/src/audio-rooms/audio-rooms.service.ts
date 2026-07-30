import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { CentrifugoService } from '../chat/centrifugo.service';
import { CreateVoiceRoomNoteDto } from './dto/voice-room-note.dto';
import { VoiceRoomNote } from './interfaces/voice-room-note.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import {
  ApproveSpeakerDto,
  ArchiveRoomDto,
  CreateAudioRoomDto,
  DemoteSpeakerDto,
  InviteCoHostDto,
  JoinRoomDto,
  RaiseHandDto,
  RemoveCoHostDto,
  SendCaptionDto,
} from './dto/audio-room.dto';
import {
  AudioRoomRecord,
  CaptionRecord,
  RoomTokenResponse,
} from './interfaces/audio-room.interface';

interface AudioRoomRow {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  language_pair: string;
  topic_tag: string;
  host_id: string;
  co_host_id?: string | null;
  is_video_stream: boolean;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  recording_url?: string | null;
  created_at: string;
}

interface UserProfileRow {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
}

@Injectable()
export class AudioRoomsService implements OnModuleInit {
  private readonly logger = new Logger(AudioRoomsService.name);
  private roomServiceClient!: RoomServiceClient;
  private livekitUrl = '';
  private apiKey = '';
  private secretKey = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  onModuleInit() {
    this.livekitUrl =
      this.configService.get<string>('LIVEKIT_URL') ||
      'https://mock.livekit.cloud';
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    this.secretKey =
      this.configService.get<string>('LIVEKIT_SECRET') ||
      'secretkey012345678901234567890123456789';

    try {
      this.roomServiceClient = new RoomServiceClient(
        this.livekitUrl,
        this.apiKey,
        this.secretKey,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Could not init LiveKit RoomServiceClient (${msg}). Will fall back to local/mock.`,
      );
    }
  }

  async createRoom(
    hostId: string,
    dto: CreateAudioRoomDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const cleanTitle = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const roomName = `room-${cleanTitle}-${Date.now()}`;

    // Try creating on LiveKit server if reachable
    if (this.roomServiceClient && !this.livekitUrl.includes('mock')) {
      try {
        await this.roomServiceClient.createRoom({
          name: roomName,
          emptyTimeout: 3600,
          maxParticipants: 500,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `LiveKit server createRoom warning (${msg}). Continuing database creation.`,
        );
      }
    }

    const languagePair = String(dto.language_pair);
    const targetLanguage = languagePair.split('-')[1] ?? languagePair;

    const response = await supabase
      .from('audio_rooms')
      .insert({
        room_name: roomName,
        title: dto.title,
        target_language: targetLanguage,
        language_pair: dto.language_pair,
        topic_tag: dto.topic_tag,
        host_id: hostId,
        is_video_stream: dto.is_video_stream ?? false,
        co_host_id: null,
        is_active: true,
        speakers: [hostId],
        raised_hands: [],
        listeners_count: 1,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to create audio room: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const row = response.data as AudioRoomRow;
    const profile = await this.usersService.getProfile(hostId);
    return {
      ...row,
      host: {
        id: profile?.id ?? hostId,
        display_name: profile?.display_name ?? 'Room Host',
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  }

  async generateToken(
    userId: string,
    dto: JoinRoomDto,
  ): Promise<RoomTokenResponse> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('room_name', dto.room_name)
      .single();
    if (!response.data) {
      throw new NotFoundException(`Audio room '${dto.room_name}' not found.`);
    }

    const room = response.data as AudioRoomRow;
    const isHost = room.host_id === userId;
    const isSpeaker =
      isHost || (room.speakers && room.speakers.includes(userId));

    const profile = await this.usersService.getProfile(userId);
    const identity = profile?.display_name
      ? `${profile.display_name}_${userId.slice(0, 6)}`
      : userId;

    const token = new AccessToken(this.apiKey, this.secretKey, {
      identity,
      name: profile?.display_name || 'Language Partner',
    });

    token.addGrant({
      roomJoin: true,
      room: dto.room_name,
      canPublish: isSpeaker,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwtToken = await token.toJwt();

    // If not speaker yet, increment listener count
    if (!isSpeaker) {
      const newCount = (room.listeners_count || 0) + 1;
      await supabase
        .from('audio_rooms')
        .update({ listeners_count: newCount })
        .eq('id', room.id);
    }

    return {
      token: jwtToken,
      room_id: room.id,
      room_name: room.room_name,
      livekit_url: this.livekitUrl,
      is_speaker: isSpeaker,
      user_id: userId,
    };
  }

  async listActiveRooms(): Promise<AudioRoomRecord[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    const data = response.data as AudioRoomRow[] | null;
    if (!data || data.length === 0) return [];

    const hostIds = Array.from(new Set(data.map((r) => r.host_id)));
    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', hostIds);
    const profileRows = (profiles ?? []) as UserProfileRow[];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    return data.map((r) => {
      const p = profileMap.get(r.host_id);
      return {
        ...r,
        host: {
          id: p?.id ?? r.host_id,
          display_name: p?.display_name ?? 'Room Host',
          avatar_url: p?.avatar_url ?? null,
        },
      };
    });
  }

  async getRoom(roomId: string): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (!response.data) throw new NotFoundException('Audio room not found');
    const row = response.data as AudioRoomRow;
    const profile = await this.usersService.getProfile(row.host_id);
    return {
      ...row,
      host: {
        id: profile?.id ?? row.host_id,
        display_name: profile?.display_name ?? 'Room Host',
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  }

  async raiseHand(userId: string, dto: RaiseHandDto): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.raised_hands.includes(userId) || room.speakers.includes(userId)) {
      return this.getRoom(dto.room_id);
    }

    const updatedHands = [...room.raised_hands, userId];
    await supabase
      .from('audio_rooms')
      .update({ raised_hands: updatedHands })
      .eq('id', room.id);

    // Publish event via Centrifugo
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'raise_hand',
      user_id: userId,
      room_id: room.id,
    });

    return this.getRoom(room.id);
  }

  async approveSpeaker(
    hostId: string,
    dto: ApproveSpeakerDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException(
        'Only the host can approve stage speaker requests.',
      );
    }

    const updatedHands = room.raised_hands.filter(
      (id) => id !== dto.target_user_id,
    );
    const updatedSpeakers = room.speakers.includes(dto.target_user_id)
      ? room.speakers
      : [...room.speakers, dto.target_user_id];

    await supabase
      .from('audio_rooms')
      .update({ raised_hands: updatedHands, speakers: updatedSpeakers })
      .eq('id', room.id);

    // Notify user via Centrifugo to refresh LiveKit token with canPublish: true
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'speaker_approved',
      target_user_id: dto.target_user_id,
      room_id: room.id,
    });

    return this.getRoom(room.id);
  }

  async muteSpeaker(
    hostId: string,
    dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException('Only the host can mute a speaker.');
    }

    // Notify user via Centrifugo to mute their microphone locally
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'force_mute',
      target_user_id: dto.target_user_id,
      room_id: room.id,
    });

    return this.getRoom(room.id);
  }

  async demoteSpeaker(
    hostId: string,
    dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException('Only the host can demote a stage speaker.');
    }

    if (room.host_id === dto.target_user_id) {
      throw new ForbiddenException('The host cannot be demoted.');
    }

    const updatedSpeakers = room.speakers.filter(
      (id) => id !== dto.target_user_id,
    );

    await supabase
      .from('audio_rooms')
      .update({ speakers: updatedSpeakers })
      .eq('id', room.id);

    // Notify user via Centrifugo to drop LiveKit publish permission (canPublish: false)
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'speaker_demoted',
      target_user_id: dto.target_user_id,
      room_id: room.id,
    });

    return this.getRoom(room.id);
  }

  async inviteCoHost(
    hostId: string,
    dto: InviteCoHostDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException('Only the host can invite a co-host.');
    }

    if (room.host_id === dto.target_user_id) {
      throw new ForbiddenException('The host cannot co-host their own room.');
    }

    const previousCoHostId =
      room.co_host_id && room.co_host_id !== dto.target_user_id
        ? room.co_host_id
        : null;

    const speakersWithoutPreviousCoHost = previousCoHostId
      ? room.speakers.filter((id) => id !== previousCoHostId)
      : room.speakers;
    const updatedSpeakers = speakersWithoutPreviousCoHost.includes(
      dto.target_user_id,
    )
      ? speakersWithoutPreviousCoHost
      : [...speakersWithoutPreviousCoHost, dto.target_user_id];
    const updatedHands = room.raised_hands.filter(
      (id) => id !== dto.target_user_id,
    );

    await supabase
      .from('audio_rooms')
      .update({
        co_host_id: dto.target_user_id,
        speakers: updatedSpeakers,
        raised_hands: updatedHands,
      })
      .eq('id', room.id);

    if (previousCoHostId) {
      // Awaited so the outgoing co-host's removal is guaranteed to arrive before the
      // incoming co-host's invite, preventing the invite from being clobbered by a
      // late-arriving removal for a different user.
      await this.centrifugoService.publish(`room_${room.id}`, {
        type: 'co_host_removed',
        target_user_id: previousCoHostId,
        room_id: room.id,
      });
    }

    // Notify the invited user via Centrifugo to publish camera/mic and join the split-screen layout
    await this.centrifugoService.publish(`room_${room.id}`, {
      type: 'co_host_invited',
      target_user_id: dto.target_user_id,
      room_id: room.id,
    });

    return this.getRoom(room.id);
  }

  async removeCoHost(
    hostId: string,
    dto: RemoveCoHostDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException('Only the host can remove the co-host.');
    }

    const removedUserId = room.co_host_id;
    const updatedSpeakers = room.speakers.filter((id) => id !== removedUserId);

    await supabase
      .from('audio_rooms')
      .update({ co_host_id: null, speakers: updatedSpeakers })
      .eq('id', room.id);

    if (removedUserId) {
      // Notify the removed co-host via Centrifugo to unpublish camera and leave the split-screen layout
      void this.centrifugoService.publish(`room_${room.id}`, {
        type: 'co_host_removed',
        target_user_id: removedUserId,
        room_id: room.id,
      });
    }

    return this.getRoom(room.id);
  }

  async sendCaption(
    userId: string,
    dto: SendCaptionDto,
  ): Promise<CaptionRecord> {
    const supabase = this.supabaseService.getClient();
    const profile = await this.usersService.getProfile(userId);
    const speakerName = profile?.display_name ?? 'Speaker';

    const response = await supabase
      .from('audio_room_captions')
      .insert({
        room_id: dto.room_id,
        speaker_id: userId,
        speaker_name: speakerName,
        text_content: dto.text_content,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to save caption: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const caption = response.data as CaptionRecord;

    // Broadcast AI speech-to-text subtitle to everyone in room via Centrifugo
    void this.centrifugoService.publish(`room_${dto.room_id}`, {
      type: 'subtitle',
      caption,
    });

    return caption;
  }

  async archiveRoom(
    hostId: string,
    dto: ArchiveRoomDto,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (!response.data) throw new NotFoundException('Room not found');
    const room = response.data as AudioRoomRow;

    if (room.host_id !== hostId) {
      throw new ForbiddenException('Only the host can archive this room.');
    }

    const recordingUrl =
      dto.recording_url ||
      `https://r2.hellotalk.mock/archive/${room.room_name}.webm`;
    await supabase
      .from('audio_rooms')
      .update({ is_active: false, recording_url: recordingUrl })
      .eq('id', room.id);

    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'room_ended',
      room_id: room.id,
      recording_url: recordingUrl,
    });

    return this.getRoom(room.id);
  }

  async getActiveHostIds(): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('audio_rooms')
      .select('host_id')
      .eq('is_active', true);
    if (error || !data) {
      this.logger.warn('Could not fetch active host IDs', error);
      return [];
    }
    const rows = data as Array<{ host_id: string }>;
    return [...new Set(rows.map((r) => r.host_id))];
  }

  async addNote(
    roomId: string,
    userId: string,
    dto: CreateVoiceRoomNoteDto,
  ): Promise<VoiceRoomNote> {
    const supabase = this.supabaseService.getClient();
    const room = await this.getRoom(roomId);
    if (!this.isAuthorizedInRoom(room, userId)) {
      throw new ForbiddenException('Only host or speakers can post notes.');
    }
    const profile = await this.usersService.getProfile(userId);
    const authorName = profile?.display_name ?? 'Unknown';

    const response = await supabase
      .from('audio_room_notes')
      .insert({
        room_id: room.id,
        author_id: userId,
        author_name: authorName,
        content: dto.content,
        vocabulary: dto.vocabulary ?? null,
      })
      .select()
      .single();
    if (response.error || !response.data) {
      throw new Error(
        `Failed to add note: ${response.error?.message ?? 'Unknown error'}`,
      );
    }
    const noteRow = response.data as VoiceRoomNote;

    // Broadcast to room via Centrifugo
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'voice_room_note',
      note: noteRow,
    });

    return noteRow;
  }

  async getNotes(roomId: string): Promise<VoiceRoomNote[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('audio_room_notes')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (response.error) {
      throw new Error(`Failed to fetch notes: ${response.error.message}`);
    }
    return (response.data ?? []) as VoiceRoomNote[];
  }

  async deleteNote(noteId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const noteResponse = await supabase
      .from('audio_room_notes')
      .select('*')
      .eq('id', noteId)
      .single();
    if (!noteResponse.data) {
      throw new NotFoundException('Note not found');
    }
    const note = noteResponse.data as VoiceRoomNote;
    const room = await this.getRoom(note.room_id);
    // Only note author or host can delete
    if (note.author_id !== userId && room.host_id !== userId) {
      throw new ForbiddenException('Not authorised to delete this note.');
    }
    const { error } = await supabase
      .from('audio_room_notes')
      .delete()
      .eq('id', noteId);
    if (error) {
      throw new Error(`Failed to delete note: ${error.message}`);
    }
    // Broadcast removal to room
    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'voice_room_note_deleted',
      note_id: noteId,
      room_id: room.id,
    });
  }

  private isAuthorizedInRoom(room: AudioRoomRecord, userId: string): boolean {
    if (room.host_id === userId) return true;
    if (room.co_host_id === userId) return true;
    if (room.speakers && room.speakers.includes(userId)) return true;
    return false;
  }
}
