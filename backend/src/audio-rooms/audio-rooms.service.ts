import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SendReactionDto } from './dto/send-reaction.dto';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { CentrifugoService } from '../chat/centrifugo.service';
import { CreateVoiceRoomNoteDto } from './dto/voice-room-note.dto';
import { VoiceRoomNote } from './interfaces/voice-room-note.interface';
import { GetCallLogsQueryDto } from './dto/get-call-logs-query.dto';
import { CallLogRecord } from './interfaces/call-log.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { TranscriptEgressService } from './transcript-egress.service';
import { NlpService } from '../nlp/nlp.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { PlaySoundDto } from './dto/play-sound.dto';
import { CreateLanguagePartyDto } from './dto/create-language-party.dto';
import { CreatePrivatePartyDto } from './dto/create-private-party.dto';
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
  party_type?: string;
  target_language: string;
  language_pair: string;
  topic_tag: string;
  level?: string;
  host_id: string;
  co_host_id?: string | null;
  is_video_stream: boolean;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  recording_url?: string | null;
  egress_id?: string | null;
  created_at: string;
  is_private?: boolean;
  invited_user_ids?: string[];
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
    private readonly transcriptEgress: TranscriptEgressService,
    private readonly nlpService: NlpService,
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
    roomNameOverride?: string,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const cleanTitle = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const roomName = roomNameOverride ?? `room-${cleanTitle}-${Date.now()}`;

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
        level: dto.level ?? undefined,
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

    // Start recording via LiveKit Egress (non‑blocking)
    const egressId = await this.transcriptEgress.startEgress(roomName);
    if (egressId) {
      await supabase
        .from('audio_rooms')
        .update({ egress_id: egressId })
        .eq('id', row.id);
    }

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

  async createLanguageParty(
    hostId: string,
    dto: CreateLanguagePartyDto,
    roomNameOverride?: string,
  ): Promise<AudioRoomRecord> {
    const supabase = this.supabaseService.getClient();
    const cleanTitle = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const roomName =
      roomNameOverride ?? `language-party-${cleanTitle}-${Date.now()}`;

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

    const insertPayload: any = {
      room_name: roomName,
      title: dto.title,
      party_type: 'language_party',
      target_language: targetLanguage,
      language_pair: dto.language_pair,
      topic_tag: dto.topic_tag ?? 'General',
      level: dto.level ?? undefined,
      host_id: hostId,
      is_video_stream: dto.is_video_stream ?? false,
      co_host_id: null,
      is_active: true,
      speakers: [hostId],
      raised_hands: [],
      listeners_count: 1,
    };

    const response = await supabase
      .from('audio_rooms')
      .insert(insertPayload)
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to create language party: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const row = response.data as AudioRoomRow;

    // Start recording via LiveKit Egress (non‑blocking)
    const egressId = await this.transcriptEgress.startEgress(roomName);
    if (egressId) {
      await supabase
        .from('audio_rooms')
        .update({ egress_id: egressId })
        .eq('id', row.id);
    }

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

  async createPrivateRoom(
    hostId: string,
    dto: CreatePrivatePartyDto,
  ): Promise<AudioRoomRecord> {
    // Verify VIP status
    const hostProfile = await this.usersService.getProfile(hostId);
    if (!hostProfile?.is_vip) {
      throw new ForbiddenException(
        'Only VIP members can create private rooms.',
      );
    }

    // Reuse base room creation
    const room = await this.createRoom(hostId, {
      title: dto.title,
      target_language: dto.target_language,
      language_pair: dto.language_pair,
      topic_tag: dto.topic_tag,
      is_video_stream: dto.is_video_stream ?? false,
      level: dto.level,
    });

    // Mark as private and store invited users
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('audio_rooms')
      .update({
        is_private: true,
        invited_user_ids: dto.invited_user_ids,
      })
      .eq('id', room.id);

    if (error) {
      this.logger.warn('Failed to set private fields', error);
    }

    return this.getRoom(room.id);
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
    // Private room access check
    if (
      (room as any).is_private &&
      !(room as any).invited_user_ids?.includes(userId) &&
      room.host_id !== userId
    ) {
      throw new ForbiddenException(
        'This is a private room. You are not invited.',
      );
    }
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

  async listActiveRooms(
    partyType?: string,
    topic?: string,
    level?: string,
  ): Promise<AudioRoomRecord[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('audio_rooms').select('*').eq('is_active', true);

    // Exclude private rooms from public listing
    query = query.or('is_private.is.null,is_private.eq.false');

    if (partyType) {
      query = query.eq('party_type', partyType);
    }
    if (topic) {
      query = query.eq('topic_tag', topic);
    }
    if (level) {
      query = query.eq('level', level);
    }

    const response = await query
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

    // Stop the LiveKit egress to obtain the recorded file URL
    const egressRecordingUrl = await this.transcriptEgress.stopEgress(
      room.room_name,
    );

    const recordingUrl =
      egressRecordingUrl ||
      dto.recording_url ||
      `https://r2.hellotalk.mock/archive/${room.room_name}.webm`;

    // Generate full transcript using speech‑to‑text (implemented via LiveKit egress or external STT)
    let transcriptText =
      this.transcriptEgress.generateTranscriptFromAudioUrl(recordingUrl);

    if (!transcriptText) {
      // fallback: build transcript from sent captions if egress not available
      const { data: captionRows } = await supabase
        .from('audio_room_captions')
        .select('text_content')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      if (
        captionRows &&
        (captionRows as { text_content: string }[]).length > 0
      ) {
        transcriptText = (captionRows as { text_content: string }[])
          .map((c) => c.text_content)
          .join(' ');
      }
    }

    const sessionSummary = transcriptText
      ? this.nlpService.generateSessionSummary(transcriptText)
      : { summary: 'No transcript available.', vocabulary: [] };

    await supabase
      .from('audio_rooms')
      .update({ is_active: false, recording_url: recordingUrl })
      .eq('id', room.id);

    // Upsert transcript row so participants can review the transcript
    await supabase.from('audio_room_transcripts').upsert(
      {
        room_id: room.id,
        recording_url: recordingUrl,
        transcript_text: transcriptText,
        session_summary: sessionSummary.summary,
        vocabulary_list: sessionSummary.vocabulary,
      },
      { onConflict: 'room_id' },
    );

    void this.centrifugoService.publish(`room_${room.id}`, {
      type: 'room_ended',
      room_id: room.id,
      recording_url: recordingUrl,
    });

    return this.getRoom(room.id);
  }

  async getDistinctTopics(): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('audio_rooms')
      .select('topic_tag')
      .eq('is_active', true);
    if (error || !data) {
      this.logger.warn('Could not fetch topics', error);
      return [];
    }
    const tags = new Set(
      (data as Array<{ topic_tag: string }>).map((r) => r.topic_tag),
    );
    return Array.from(tags).sort();
  }

  async getDistinctLevels(): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('audio_rooms')
      .select('level')
      .eq('is_active', true);
    if (error || !data) {
      this.logger.warn('Could not fetch levels', error);
      return [];
    }
    const levels = new Set(
      (data as Array<{ level: string | null }>)
        .map((r) => r.level)
        .filter((l): l is string => l !== null && l !== ''),
    );
    return Array.from(levels).sort();
  }

  async getInvitedPrivateRooms(userId: string): Promise<AudioRoomRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('is_active', true)
      .eq('is_private', true)
      .or(`host_id.eq.${userId},invited_user_ids.cs.["${userId}"]`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      this.logger.warn('Could not fetch invited private rooms', error);
      return [];
    }

    const rows = data as AudioRoomRow[];
    if (rows.length === 0) return [];

    const hostIds = Array.from(new Set(rows.map((r) => r.host_id)));
    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', hostIds);
    const profileRows = (profiles ?? []) as UserProfileRow[];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    return rows.map((r) => {
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

  async createPoll(
    hostId: string,
    roomId: string,
    dto: CreatePollDto,
  ): Promise<{ poll_id: string }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('quick_polls')
      .insert({
        room_id: roomId,
        host_id: hostId,
        question: dto.question,
        options: dto.options,
      })
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(`Failed to create poll: ${error?.message ?? 'Unknown'}`);
    }
    void this.centrifugoService.publish(`room_${roomId}`, {
      type: 'poll_opened',
      poll_id: data.id,
      question: dto.question,
      options: dto.options,
    });
    return { poll_id: data.id };
  }

  async submitVote(userId: string, dto: SubmitVoteDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: poll, error: pollError } = await supabase
      .from('quick_polls')
      .select('id, room_id, is_active, options')
      .eq('id', dto.pollId)
      .single();
    if (pollError || !poll) {
      throw new Error('Poll not found');
    }
    if (!poll.is_active) {
      throw new Error('Poll is no longer active');
    }
    if (dto.optionIndex < 0 || dto.optionIndex >= poll.options.length) {
      throw new Error('Invalid option index');
    }
    const { error: insertError } = await supabase.from('poll_votes').insert({
      poll_id: dto.pollId,
      user_id: userId,
      option_index: dto.optionIndex,
    });
    if (insertError) {
      throw new Error('You have already voted on this poll');
    }
    void this.centrifugoService.publish(`room_${poll.room_id}`, {
      type: 'vote_cast',
      poll_id: dto.pollId,
      option_index: dto.optionIndex,
    });
  }

  async getPollResults(
    roomId: string,
    pollId: string,
  ): Promise<{
    question: string;
    options: string[];
    votes: number[];
    totalVotes: number;
  }> {
    const supabase = this.supabaseService.getClient();
    const { data: poll, error: pollError } = await supabase
      .from('quick_polls')
      .select('id, question, options')
      .eq('id', pollId)
      .single();
    if (pollError || !poll) {
      throw new Error('Poll not found');
    }
    const { data: voteRows } = await supabase
      .from('poll_votes')
      .select('option_index')
      .eq('poll_id', pollId);
    const optionCount = poll.options.length;
    const votes = Array(optionCount).fill(0) as number[];
    let totalVotes = 0;
    if (voteRows) {
      for (const row of voteRows as Array<{ option_index: number }>) {
        if (row.option_index >= 0 && row.option_index < optionCount) {
          votes[row.option_index]++;
          totalVotes++;
        }
      }
    }
    return {
      question: poll.question,
      options: poll.options,
      votes,
      totalVotes,
    };
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

  /**
   * Returns the recording_url and optionally the transcript_text for a completed room.
   */
  async getTranscript(roomId: string): Promise<{
    recording_url: string | null;
    transcript_text: string | null;
    session_summary: string | null;
    vocabulary: string[];
  }> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('audio_room_transcripts')
      .select(
        'recording_url, transcript_text, session_summary, vocabulary_list',
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return {
        recording_url: null,
        transcript_text: null,
        session_summary: null,
        vocabulary: [],
      };
    }
    const row = data;
    return {
      recording_url: row.recording_url,
      transcript_text: row.transcript_text,
      session_summary: row.session_summary,
      vocabulary: row.vocabulary_list ?? [],
    };
  }

  private isAuthorizedInRoom(room: AudioRoomRecord, userId: string): boolean {
    if (room.host_id === userId) return true;
    if (room.co_host_id === userId) return true;
    if (room.speakers && room.speakers.includes(userId)) return true;
    return false;
  }

  async sendReaction(
    userId: string,
    roomId: string,
    dto: SendReactionDto,
  ): Promise<{ emojiId: string; animationUrl: string }> {
    const room = await this.getRoom(roomId);
    const profile = await this.usersService.getProfile(userId);
    if (!profile?.is_vip) {
      throw new ForbiddenException(
        'Only Pro members can send exclusive reactions.',
      );
    }
    const emoji = this.getExclusiveEmojis().find(
      (e) => e.emojiId === dto.emojiId,
    );
    if (!emoji) {
      throw new NotFoundException(`Emoji '${dto.emojiId}' not found.`);
    }
    const reactionPayload = {
      type: 'exclusive_reaction',
      emojiId: dto.emojiId,
      emojiName: emoji.name,
      animationUrl: emoji.animationUrl,
      userId,
      timestamp: new Date().toISOString(),
    };
    await this.centrifugoService.publish(`room_${room.id}`, reactionPayload);
    return { emojiId: dto.emojiId, animationUrl: emoji.animationUrl };
  }

  async getCallLogs(
    userId: string,
    query: GetCallLogsQueryDto,
  ): Promise<CallLogRecord[]> {
    const supabase = this.supabaseService.getClient();
    let supabaseQuery = supabase
      .from('call_logs')
      .select('*')
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('started_at', { ascending: false })
      .range(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 20) - 1);

    if (query.callType) {
      supabaseQuery = supabaseQuery.eq('call_type', query.callType);
    }

    const { data, error } = await supabaseQuery;
    if (error) {
      this.logger.warn('Failed to fetch call logs', error);
      return [];
    }
    return (data ?? []) as CallLogRecord[];
  }

  private readonly soundboardSounds = [
    {
      id: 'applause',
      name: 'Applause',
      url: 'https://r2.hellotalk.mock/sounds/applause.mp3',
      icon: '👏',
    },
    {
      id: 'laugh',
      name: 'Laughter',
      url: 'https://r2.hellotalk.mock/sounds/laugh.mp3',
      icon: '😂',
    },
    {
      id: 'drumroll',
      name: 'Drum Roll',
      url: 'https://r2.hellotalk.mock/sounds/drumroll.mp3',
      icon: '🥁',
    },
    {
      id: 'airhorn',
      name: 'Air Horn',
      url: 'https://r2.hellotalk.mock/sounds/airhorn.mp3',
      icon: '📯',
    },
    {
      id: 'gong',
      name: 'Gong',
      url: 'https://r2.hellotalk.mock/sounds/gong.mp3',
      icon: '🔔',
    },
  ];

  private readonly exclusiveEmojiList: {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] = [
    {
      emojiId: 'star',
      name: '🌟 Star',
      animationUrl: 'https://r2.hellotalk.mock/exclusive/star.json',
    },
    {
      emojiId: 'diamond',
      name: '💎 Diamond',
      animationUrl: 'https://r2.hellotalk.mock/exclusive/diamond.json',
    },
    {
      emojiId: 'unicorn',
      name: '🦄 Unicorn',
      animationUrl: 'https://r2.hellotalk.mock/exclusive/unicorn.json',
    },
    {
      emojiId: 'fire',
      name: '🔥 Fire',
      animationUrl: 'https://r2.hellotalk.mock/exclusive/fire.json',
    },
  ];

  getExclusiveEmojis(): {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] {
    return this.exclusiveEmojiList;
  }

  getSoundboardSounds(): { sounds: any[] } {
    return { sounds: this.soundboardSounds };
  }

  async playSound(
    userId: string,
    dto: PlaySoundDto,
  ): Promise<{ success: boolean; soundUrl: string | null }> {
    const supabase = this.supabaseService.getClient();
    const { data: roomRow, error } = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('id', dto.room_id)
      .single();
    if (error || !roomRow) {
      throw new NotFoundException('Room not found');
    }
    const room = roomRow as AudioRoomRow;
    // Only host or co‑host may play a sound
    if (room.host_id !== userId && room.co_host_id !== userId) {
      throw new ForbiddenException('Only the host or co‑host can play a sound');
    }
    const sound = this.soundboardSounds.find((s) => s.id === dto.sound_id);
    if (!sound) {
      throw new NotFoundException(`Sound '${dto.sound_id}' not found`);
    }
    // Publish the sound effect to every participant via Centrifugo
    await this.centrifugoService.publish(`room_${room.id}`, {
      type: 'soundboard_play',
      sound_id: sound.id,
      sound_name: sound.name,
      sound_url: sound.url,
      triggered_by: userId,
    });
    return { success: true, soundUrl: sound.url };
  }
}
