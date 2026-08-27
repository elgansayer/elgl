import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AudioRoomsService,
  SoundboardSound,
  StageInfo,
} from './audio-rooms.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { PlaySoundDto } from './dto/play-sound.dto';
import {
  ApproveSpeakerDto,
  ArchiveRecordingDto,
  ArchiveRoomDto,
  CreateAudioRoomDto,
  DemoteSpeakerDto,
  DismissRaisedHandDto,
  InviteCoHostDto,
  RaiseHandDto,
  RemoveCoHostDto,
  SendCaptionDto,
} from './dto/audio-room.dto';
import { AudioRoomTokenDto } from './dto/audio-room-token.dto';
import {
  AudioRoomRecord,
  CaptionRecord,
  RoomTokenResponse,
} from './interfaces/audio-room.interface';
import { CallLogRecord } from './interfaces/call-log.interface';
import { VoiceRoomNote } from './interfaces/voice-room-note.interface';
import { CreateVoiceRoomNoteDto } from './dto/voice-room-note.dto';
import { GetCallLogsQueryDto } from './dto/get-call-logs-query.dto';
import { CreateLanguagePartyDto } from './dto/create-language-party.dto';
import { CreatePrivatePartyDto } from './dto/create-private-party.dto';
import { SendReactionDto } from './dto/send-reaction.dto';
import { TipHostDto } from './dto/tip-host.dto';
import { ReorderStageDto } from './dto/reorder-stage.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_VERY_SHORT,
  CACHE_PUBLIC_SHORT,
  CACHE_EDGE_SHORT,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
  CACHE_TAG_AUDIO_ROOMS,
  CACHE_TAG_AUDIO_ROOM_STAGE,
  CACHE_TAG_AUDIO_ROOM_POLLS,
  CACHE_TAG_AUDIO_ROOM_TRANSCRIPT,
  CACHE_TAG_AUDIO_ROOM_NOTES,
} from '../common/cache.interceptor';

// Type representing the authenticated user fields used in the controller.
interface AuthUser {
  id: string;
  email?: string;
}

@ApiTags('Video Classrooms')
@Controller('audio-rooms')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class AudioRoomsController {
  constructor(
    private readonly audioRoomsService: AudioRoomsService,
    @InjectPinoLogger(AudioRoomsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a new audio room',
    description:
      'Creates a new audio room for language exchange with the specified title, ' +
      'target language, language pair, topic tag, and optional video stream flag. ' +
      'Returns the created room record.',
  })
  @ApiResponse({
    status: 201,
    description: 'Audio room created successfully.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'room_a1b2c3d4' },
        title: { type: 'string', example: 'Spanish Conversation Practice' },
        target_language: { type: 'string', example: 'es' },
        language_pair: { type: 'string', example: 'en-es' },
        topic_tag: { type: 'string', example: 'conversation' },
        is_video_stream: { type: 'boolean', example: false },
        host_id: {
          type: 'string',
          example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        },
        participants_count: { type: 'number', example: 1 },
        created_at: { type: 'string', example: '2026-08-07T10:30:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createRoom(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreateAudioRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createRoom(user.id, dto);
  }

  @Post('archive-recording')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Archive a room recording',
    description:
      'Archives a recording URL for a specified audio room. ' +
      'The recording is stored for later playback and transcript generation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Recording archived successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async archiveRecording(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ArchiveRecordingDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.archiveRecording(user.id, dto);
  }

  @Post('token')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Generate a LiveKit access token for an audio room',
    description:
      'Generates a LiveKit access token for the authenticated user to join ' +
      'a specific audio room. Returns the token and room metadata.',
  })
  @ApiResponse({
    status: 201,
    description: 'Token generated successfully.',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'LiveKit access token',
          example: 'eyJhbGciOi...',
        },
        room_name: { type: 'string', example: 'room_a1b2c3d4' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async generateToken(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: AudioRoomTokenDto,
  ): Promise<RoomTokenResponse | null> {
    if (!user) return null;
    return await this.audioRoomsService.generateToken(user.id, dto);
  }

  @Get('list')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_VERY_SHORT, [
      CACHE_TAG_AUDIO_ROOMS,
    ]),
  )
  @ApiOperation({
    summary: 'List active audio rooms',
    description:
      'Returns all currently active audio rooms, optionally filtered by party type, topic, or level. ' +
      'Responses are cached very briefly for performance.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by party type',
    example: 'language_party',
  })
  @ApiQuery({
    name: 'topic',
    required: false,
    description: 'Filter by topic',
    example: 'conversation',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description: 'Filter by proficiency level',
    example: 'intermediate',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of active audio rooms.',
    schema: { type: 'array', items: { type: 'object' } },
  })
  async listActiveRooms(
    @Query('type') partyType?: string,
    @Query('topic') topic?: string,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AudioRoomRecord[]> {
    return await this.audioRoomsService.listActiveRooms(
      partyType,
      topic,
      level,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('by-language')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_VERY_SHORT, [
      CACHE_TAG_AUDIO_ROOMS,
    ]),
  )
  @ApiOperation({
    summary: 'List active rooms grouped by language pair',
    description:
      'Returns active audio rooms grouped by language pair with counts. ' +
      'Useful for displaying language-specific browsing in the discovery UI.',
  })
  @ApiResponse({
    status: 200,
    description: 'Language-pair grouped room listings.',
  })
  async listActiveRoomsByLanguage(): Promise<
    Array<{
      language_pair: string;
      count: number;
      rooms: AudioRoomRecord[];
    }>
  > {
    return await this.audioRoomsService.listActiveRoomsByLanguage();
  }

  @Get('topics')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiOperation({
    summary: 'Get distinct topic tags',
    description:
      'Returns all distinct topic tags currently in use across audio rooms. ' +
      'Used to populate topic filter controls.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of distinct topic strings.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['conversation', 'grammar', 'culture'],
    },
  })
  async getDistinctTopics(): Promise<string[]> {
    return await this.audioRoomsService.getDistinctTopics();
  }

  @Get('levels')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiOperation({
    summary: 'Get distinct proficiency levels',
    description:
      'Returns all distinct proficiency levels currently in use. ' +
      'Used to populate level filter controls.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of distinct level strings.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['beginner', 'intermediate', 'advanced'],
    },
  })
  async getDistinctLevels(): Promise<string[]> {
    return await this.audioRoomsService.getDistinctLevels();
  }

  @Get('private')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'Get private rooms the user is invited to',
    description:
      'Returns all private audio rooms that the authenticated user has been invited to.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of private audio rooms.',
  })
  async getPrivateRooms(
    @CurrentUser() user: AuthUser | null,
  ): Promise<AudioRoomRecord[]> {
    if (!user) return [];
    return this.audioRoomsService.getInvitedPrivateRooms(user.id);
  }

  @Get('call-logs')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'Get call history logs for the authenticated user',
    description:
      'Returns paginated call history for the authenticated user, filtered by call type. ' +
      'Supports pagination via limit and offset query parameters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of call log records.',
  })
  async getCallLogs(
    @CurrentUser() user: AuthUser | null,
    @Query() query: GetCallLogsQueryDto,
  ): Promise<CallLogRecord[]> {
    if (!user) return [];
    return this.audioRoomsService.getCallLogs(user.id, query);
  }

  @Get('exclusive-emojis')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiOperation({
    summary: 'Get exclusive emoji/reaction animations',
    description:
      'Returns the list of exclusive animated emoji reactions available for use in audio rooms.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exclusive emoji list.',
  })
  getExclusiveEmojis(): {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] {
    return this.audioRoomsService.getExclusiveEmojis();
  }

  @Get(':id')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_VERY_SHORT, [
      CACHE_TAG_AUDIO_ROOM_STAGE,
    ]),
  )
  @ApiOperation({
    summary: 'Get room details by ID',
    description: 'Returns full details for a specific audio room by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio room record.',
  })
  async getRoom(@Param('id') id: string): Promise<AudioRoomRecord> {
    return await this.audioRoomsService.getRoom(id);
  }

  @Get(':id/stage')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_VERY_SHORT, [
      CACHE_TAG_AUDIO_ROOM_STAGE,
    ]),
  )
  @ApiOperation({
    summary: 'Get stage information for a room',
    description:
      'Returns the current stage state including speakers, hand-raised listeners, and co-hosts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Stage information.',
  })
  async getStage(@Param('id') roomId: string): Promise<StageInfo> {
    return this.audioRoomsService.getStage(roomId);
  }

  @Post(':id/stage/reorder')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Reorder speakers on the stage',
    description:
      'Reorders the speakers on the stage for a given audio room. Only the host or co-host can perform this action.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Stage speakers reordered successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async reorderSpeakers(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
    @Body() dto: ReorderStageDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.reorderSpeakers(
      user.id,
      roomId,
      dto.speaker_order,
    );
  }

  @Post(':id/stage/clear')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Clear all speakers from the stage',
    description:
      'Removes all speakers from the stage. Only the host can perform this action.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Stage cleared successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async clearStage(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.clearStage(user.id, roomId);
  }

  @Post('language-parties')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a language party',
    description:
      'Creates a new language party room with extended configuration options ' +
      'including max speakers and duration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Language party created successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createLanguageParty(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreateLanguagePartyDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createLanguageParty(user.id, dto);
  }

  @Post('private')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a private (invite-only) audio room',
    description:
      'Creates a private audio room accessible only to invited users. ' +
      'The creator specifies the list of invited user IDs.',
  })
  @ApiResponse({
    status: 201,
    description: 'Private audio room created successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createPrivateParty(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreatePrivatePartyDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createPrivateRoom(user.id, dto);
  }

  @Post('raise-hand')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Raise hand to request speaking',
    description:
      'A listener raises their hand in a room to request being brought onto the stage as a speaker.',
  })
  @ApiResponse({
    status: 201,
    description: 'Hand raised successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async raiseHand(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: RaiseHandDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.raiseHand(user.id, dto);
  }

  @Post('approve-speaker')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Approve a listener to become a speaker',
    description:
      'A host or co-host approves a listener (who has raised their hand) to join the stage as a speaker.',
  })
  @ApiResponse({
    status: 201,
    description: 'Speaker approved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async approveSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ApproveSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.approveSpeaker(user.id, dto);
  }

  @Post('mute-speaker')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Mute a speaker on the stage',
    description:
      'A host or co-host mutes a speaker currently on stage without removing them.',
  })
  @ApiResponse({
    status: 201,
    description: 'Speaker muted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async muteSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.muteSpeaker(user.id, dto);
  }

  @Post('kick-speaker')
  async kickSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.kickSpeaker(user.id, dto);
  }

  @Post('demote-speaker')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Demote a speaker back to listener',
    description:
      'Removes a speaker from the stage, returning them to the listener role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Speaker demoted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async demoteSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.demoteSpeaker(user.id, dto);
  }

  @Post('dismiss-raised-hand')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismissRaisedHand(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DismissRaisedHandDto,
  ): Promise<void> {
    if (!user) return;
    return await this.audioRoomsService.dismissRaisedHand(user.id, dto);
  }

  @Post('invite-co-host')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Invite a user to become a co-host',
    description:
      'The host invites another user to become a co-host, granting them stage management permissions.',
  })
  @ApiResponse({
    status: 201,
    description: 'Co-host invited successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async inviteCoHost(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: InviteCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.inviteCoHost(user.id, dto);
  }

  @Post('remove-co-host')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Remove a co-host',
    description:
      'The host removes a co-host, revoking their management permissions.',
  })
  @ApiResponse({
    status: 201,
    description: 'Co-host removed successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async removeCoHost(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: RemoveCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.removeCoHost(user.id, dto);
  }

  @Post('captions')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Send a caption to the room',
    description:
      'Broadcasts a text caption to the room. Used for live captions and translations.',
  })
  @ApiResponse({
    status: 201,
    description: 'Caption sent successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async sendCaption(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: SendCaptionDto,
  ): Promise<CaptionRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.sendCaption(user.id, dto);
  }

  @Post('ai-captions')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Broadcast an AI-generated caption',
    description:
      'Broadcasts an AI-generated caption to the room without user authentication. ' +
      'Used by automated transcription services.',
  })
  @ApiResponse({
    status: 201,
    description: 'AI caption broadcast successfully.',
  })
  async broadcastAICaption(@Body() dto: SendCaptionDto): Promise<void> {
    await this.audioRoomsService.broadcastAICaption(dto);
  }

  @Post('archive')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Archive (close) an audio room',
    description:
      'Archives an active audio room, marking it as closed and optionally storing a recording URL.',
  })
  @ApiResponse({
    status: 201,
    description: 'Room archived successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async archiveRoom(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ArchiveRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.archiveRoom(user.id, dto);
  }

  @Post(':roomId/notes')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Add a note to an audio room',
    description:
      'Adds a personal note to an audio room. Notes can include vocabulary references.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Note added successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async addNote(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: CreateVoiceRoomNoteDto,
  ): Promise<VoiceRoomNote | null> {
    if (!user) return null;
    return await this.audioRoomsService.addNote(roomId, user.id, dto);
  }

  @Get(':roomId/notes')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_AUDIO_ROOM_NOTES]),
  )
  @ApiOperation({
    summary: 'Get notes for an audio room',
    description: 'Returns all notes associated with a specific audio room.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of voice room notes.',
  })
  async getNotes(@Param('roomId') roomId: string): Promise<VoiceRoomNote[]> {
    return await this.audioRoomsService.getNotes(roomId);
  }

  @Delete(':roomId/notes/:noteId')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Delete a note from an audio room',
    description:
      'Deletes a specific note by ID. Only the note author can delete their own notes.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiParam({
    name: 'noteId',
    description: 'Note ID to delete',
    example: 'note_xyz789',
  })
  @ApiResponse({
    status: 200,
    description: 'Note deleted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async deleteNote(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') _roomId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    if (!user) return;
    return await this.audioRoomsService.deleteNote(noteId, user.id);
  }

  /**
   * Retrieve the recorded transcript for a completed audio room session.
   * Returns { recording_url, transcript_text, session_summary, vocabulary } if available.
   */
  @Get(':id/transcript')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [
      CACHE_TAG_AUDIO_ROOM_TRANSCRIPT,
    ]),
  )
  @ApiOperation({
    summary: 'Get the transcript for a completed audio room session',
    description:
      'Returns the recording URL, transcript text, session summary, and vocabulary list ' +
      'for a completed audio room if available.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcript data.',
    schema: {
      type: 'object',
      properties: {
        recording_url: {
          type: 'string',
          nullable: true,
          example: 'https://r2.example.com/recordings/room_a1b2c3d4.mp3',
        },
        transcript_text: {
          type: 'string',
          nullable: true,
          example: 'Speaker A: Hola...',
        },
        session_summary: {
          type: 'string',
          nullable: true,
          example: 'Practised greetings and introductions in Spanish.',
        },
        vocabulary: {
          type: 'array',
          items: { type: 'string' },
          example: ['hola', 'gracias', 'adios'],
        },
      },
    },
  })
  async getTranscript(@Param('id') roomId: string): Promise<{
    recording_url: string | null;
    transcript_text: string | null;
    session_summary: string | null;
    vocabulary: string[];
  }> {
    return this.audioRoomsService.getTranscript(roomId);
  }

  @Post(':roomId/polls')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a poll in an audio room',
    description:
      'Creates a poll with multiple options for participants in the audio room to vote on.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Poll created successfully.',
    schema: {
      type: 'object',
      properties: {
        poll_id: {
          type: 'string',
          example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createPoll(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: CreatePollDto,
  ): Promise<{ poll_id: string } | null> {
    if (!user) return null;
    return await this.audioRoomsService.createPoll(user.id, roomId, dto);
  }

  @Post('polls/vote')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Submit a vote in a poll',
    description:
      'Submits a vote for a poll option. Each user can vote once per poll.',
  })
  @ApiResponse({
    status: 201,
    description: 'Vote submitted successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async submitVote(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: SubmitVoteDto,
  ): Promise<void> {
    if (!user) return;
    return await this.audioRoomsService.submitVote(user.id, dto);
  }

  @Get(':roomId/polls/:pollId')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_PUBLIC_VERY_SHORT, [
      CACHE_TAG_AUDIO_ROOM_POLLS,
    ]),
  )
  @ApiOperation({
    summary: 'Get poll results',
    description:
      'Returns the current results for a specific poll, including vote counts per option.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiParam({
    name: 'pollId',
    description: 'Poll ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Poll results.',
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          example: 'Which topic should we discuss next?',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          example: ['Travel', 'Food', 'Music'],
        },
        votes: { type: 'array', items: { type: 'number' }, example: [5, 3, 8] },
        totalVotes: { type: 'number', example: 16 },
      },
    },
  })
  async getPollResults(
    @Param('roomId') _roomId: string,
    @Param('pollId') pollId: string,
  ): Promise<{
    question: string;
    options: string[];
    votes: number[];
    totalVotes: number;
  }> {
    return this.audioRoomsService.getPollResults(_roomId, pollId);
  }

  @Get('soundboard/list')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'List available soundboard sounds',
    description:
      'Returns all available soundboard sounds that can be played in audio rooms. ' +
      'Responses are cached long-term as sounds rarely change.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of soundboard sounds.',
  })
  listSoundboardSounds(): { sounds: SoundboardSound[] } {
    return this.audioRoomsService.getSoundboardSounds();
  }

  @Post('soundboard/play')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Play a soundboard sound in a room',
    description:
      'Plays a soundboard sound effect in the specified audio room. ' +
      'The sound is broadcast to all participants.',
  })
  @ApiResponse({
    status: 201,
    description: 'Sound played successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        soundUrl: {
          type: 'string',
          nullable: true,
          example: 'https://r2.example.com/sounds/applause.mp3',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async playSound(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: PlaySoundDto,
  ): Promise<{ success: boolean; soundUrl: string | null } | null> {
    if (!user) return null;
    return await this.audioRoomsService.playSound(user.id, dto);
  }

  @Post(':roomId/reactions')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Send a reaction to the room',
    description:
      'Sends an animated emoji reaction to the room, visible to all participants.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Reaction sent successfully.',
    schema: {
      type: 'object',
      properties: {
        emojiId: { type: 'string', example: 'emoji_heart_eyes' },
        animationUrl: {
          type: 'string',
          example: 'https://r2.example.com/emojis/heart_eyes.json',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async sendReaction(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: SendReactionDto,
  ): Promise<{ emojiId: string; animationUrl: string } | null> {
    if (!user) return null;
    return await this.audioRoomsService.sendReaction(user.id, roomId, dto);
  }

  @Post(':roomId/tip')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Tip the host of an audio room',
    description:
      'Sends a coin tip to the host of the specified audio room. ' +
      'Deducts coins from the sender and credits the host.',
  })
  @ApiParam({
    name: 'roomId',
    description: 'Audio room ID',
    example: 'room_a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Tip sent successfully.',
    schema: {
      type: 'object',
      properties: {
        tip_id: { type: 'string', example: 'tip_abc123' },
        amount_coins: { type: 'number', example: 10 },
        receiver_id: {
          type: 'string',
          example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
        },
        receiver_new_balance: { type: 'number', example: 260 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async tipHost(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: TipHostDto,
  ): Promise<{
    tip_id: string;
    amount_coins: number;
    receiver_id: string;
    receiver_new_balance: number;
  } | null> {
    if (!user) return null;
    return await this.audioRoomsService.tipHost(user.id, {
      room_id: roomId,
      amount_coins: dto.amount_coins,
    });
  }
}
