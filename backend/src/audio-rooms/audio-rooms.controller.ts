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
} from '@nestjs/common';
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
  ArchiveRoomDto,
  CreateAudioRoomDto,
  DemoteSpeakerDto,
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
import { ReorderStageDto } from './dto/reorder-stage.dto';

// Type representing the authenticated user fields used in the controller.
interface AuthUser {
  id: string;
  email?: string;
}

@Controller('audio-rooms')
@UseGuards(SupabaseAuthGuard)
export class AudioRoomsController {
  constructor(private readonly audioRoomsService: AudioRoomsService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreateAudioRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createRoom(user.id, dto);
  }

  @Post('archive-recording')
  async archiveRecording(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ArchiveRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.archiveRecording(user.id, dto);
  }

  @Post('token')
  async generateToken(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: AudioRoomTokenDto,
  ): Promise<RoomTokenResponse | null> {
    if (!user) return null;
    return await this.audioRoomsService.generateToken(user.id, dto);
  }

  @Get('list')
  async listActiveRooms(
    @Query('type') partyType?: string,
    @Query('topic') topic?: string,
    @Query('level') level?: string,
  ): Promise<AudioRoomRecord[]> {
    return await this.audioRoomsService.listActiveRooms(
      partyType,
      topic,
      level,
    );
  }

  @Get('topics')
  async getDistinctTopics(): Promise<string[]> {
    return await this.audioRoomsService.getDistinctTopics();
  }

  @Get('levels')
  async getDistinctLevels(): Promise<string[]> {
    return await this.audioRoomsService.getDistinctLevels();
  }

  @Get('private')
  async getPrivateRooms(
    @CurrentUser() user: AuthUser | null,
  ): Promise<AudioRoomRecord[]> {
    if (!user) return [];
    return this.audioRoomsService.getInvitedPrivateRooms(user.id);
  }

  @Get('call-logs')
  async getCallLogs(
    @CurrentUser() user: AuthUser | null,
    @Query() query: GetCallLogsQueryDto,
  ): Promise<CallLogRecord[]> {
    if (!user) return [];
    return this.audioRoomsService.getCallLogs(user.id, query);
  }

  @Get('exclusive-emojis')
  getExclusiveEmojis(): {
    emojiId: string;
    name: string;
    animationUrl: string;
  }[] {
    return this.audioRoomsService.getExclusiveEmojis();
  }

  @Get(':id')
  async getRoom(@Param('id') id: string): Promise<AudioRoomRecord> {
    return await this.audioRoomsService.getRoom(id);
  }

  @Get(':id/stage')
  async getStage(@Param('id') roomId: string): Promise<StageInfo> {
    return this.audioRoomsService.getStage(roomId);
  }

  @Post(':id/stage/reorder')
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
  async clearStage(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.clearStage(user.id, roomId);
  }

  @Post('language-parties')
  async createLanguageParty(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreateLanguagePartyDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createLanguageParty(user.id, dto);
  }

  @Post('private')
  async createPrivateParty(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: CreatePrivatePartyDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createPrivateRoom(user.id, dto);
  }

  @Post('raise-hand')
  async raiseHand(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: RaiseHandDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.raiseHand(user.id, dto);
  }

  @Post('approve-speaker')
  async approveSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ApproveSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.approveSpeaker(user.id, dto);
  }

  @Post('mute-speaker')
  async muteSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.muteSpeaker(user.id, dto);
  }

  @Post('demote-speaker')
  async demoteSpeaker(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.demoteSpeaker(user.id, dto);
  }

  @Post('invite-co-host')
  async inviteCoHost(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: InviteCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.inviteCoHost(user.id, dto);
  }

  @Post('remove-co-host')
  async removeCoHost(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: RemoveCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.removeCoHost(user.id, dto);
  }

  @Post('captions')
  async sendCaption(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: SendCaptionDto,
  ): Promise<CaptionRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.sendCaption(user.id, dto);
  }

  @Post('ai-captions')
  async broadcastAICaption(@Body() dto: SendCaptionDto): Promise<void> {
    await this.audioRoomsService.broadcastAICaption(dto);
  }

  @Post('archive')
  async archiveRoom(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: ArchiveRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.archiveRoom(user.id, dto);
  }

  @Post(':roomId/notes')
  async addNote(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: CreateVoiceRoomNoteDto,
  ): Promise<VoiceRoomNote | null> {
    if (!user) return null;
    return await this.audioRoomsService.addNote(roomId, user.id, dto);
  }

  @Get(':roomId/notes')
  async getNotes(@Param('roomId') roomId: string): Promise<VoiceRoomNote[]> {
    return await this.audioRoomsService.getNotes(roomId);
  }

  @Delete(':roomId/notes/:noteId')
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
  async getTranscript(@Param('id') roomId: string): Promise<{
    recording_url: string | null;
    transcript_text: string | null;
    session_summary: string | null;
    vocabulary: string[];
  }> {
    return this.audioRoomsService.getTranscript(roomId);
  }

  @Post(':roomId/polls')
  async createPoll(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: CreatePollDto,
  ): Promise<{ poll_id: string } | null> {
    if (!user) return null;
    return await this.audioRoomsService.createPoll(user.id, roomId, dto);
  }

  @Post('polls/vote')
  async submitVote(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: SubmitVoteDto,
  ): Promise<void> {
    if (!user) return;
    return await this.audioRoomsService.submitVote(user.id, dto);
  }

  @Get(':roomId/polls/:pollId')
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
  listSoundboardSounds(): { sounds: SoundboardSound[] } {
    return this.audioRoomsService.getSoundboardSounds();
  }

  @Post('soundboard/play')
  async playSound(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: PlaySoundDto,
  ): Promise<{ success: boolean; soundUrl: string | null } | null> {
    if (!user) return null;
    return await this.audioRoomsService.playSound(user.id, dto);
  }

  @Post(':roomId/reactions')
  async sendReaction(
    @CurrentUser() user: AuthUser | null,
    @Param('roomId') roomId: string,
    @Body() dto: SendReactionDto,
  ): Promise<{ emojiId: string; animationUrl: string } | null> {
    if (!user) return null;
    return await this.audioRoomsService.sendReaction(user.id, roomId, dto);
  }
}
