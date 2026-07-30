import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AudioRoomsService } from './audio-rooms.service';
import { TranscriptEgressService } from './transcript-egress.service';
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
import { VoiceRoomNote } from './interfaces/voice-room-note.interface';
import { CreateVoiceRoomNoteDto } from './dto/voice-room-note.dto';

@Controller('audio-rooms')
@UseGuards(SupabaseAuthGuard)
export class AudioRoomsController {
  constructor(private readonly audioRoomsService: AudioRoomsService) {}

  @Post('create')
  async createRoom(
    @CurrentUser() user: User | null,
    @Body() dto: CreateAudioRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.createRoom(user.id, dto);
  }

  @Post('token')
  async generateToken(
    @CurrentUser() user: User | null,
    @Body() dto: JoinRoomDto,
  ): Promise<RoomTokenResponse | null> {
    if (!user) return null;
    return await this.audioRoomsService.generateToken(user.id, dto);
  }

  @Get('list')
  async listActiveRooms(): Promise<AudioRoomRecord[]> {
    return await this.audioRoomsService.listActiveRooms();
  }

  @Get(':id')
  async getRoom(@Param('id') id: string): Promise<AudioRoomRecord> {
    return await this.audioRoomsService.getRoom(id);
  }

  @Post('raise-hand')
  async raiseHand(
    @CurrentUser() user: User | null,
    @Body() dto: RaiseHandDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.raiseHand(user.id, dto);
  }

  @Post('approve-speaker')
  async approveSpeaker(
    @CurrentUser() user: User | null,
    @Body() dto: ApproveSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.approveSpeaker(user.id, dto);
  }

  @Post('mute-speaker')
  async muteSpeaker(
    @CurrentUser() user: User | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.muteSpeaker(user.id, dto);
  }

  @Post('demote-speaker')
  async demoteSpeaker(
    @CurrentUser() user: User | null,
    @Body() dto: DemoteSpeakerDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.demoteSpeaker(user.id, dto);
  }

  @Post('invite-co-host')
  async inviteCoHost(
    @CurrentUser() user: User | null,
    @Body() dto: InviteCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.inviteCoHost(user.id, dto);
  }

  @Post('remove-co-host')
  async removeCoHost(
    @CurrentUser() user: User | null,
    @Body() dto: RemoveCoHostDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.removeCoHost(user.id, dto);
  }

  @Post('captions')
  async sendCaption(
    @CurrentUser() user: User | null,
    @Body() dto: SendCaptionDto,
  ): Promise<CaptionRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.sendCaption(user.id, dto);
  }

  @Post('archive')
  async archiveRoom(
    @CurrentUser() user: User | null,
    @Body() dto: ArchiveRoomDto,
  ): Promise<AudioRoomRecord | null> {
    if (!user) return null;
    return await this.audioRoomsService.archiveRoom(user.id, dto);
  }

  @Post(':roomId/notes')
  async addNote(
    @CurrentUser() user: User | null,
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
    @CurrentUser() user: User | null,
    @Param('roomId') _roomId: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    if (!user) return;
    return await this.audioRoomsService.deleteNote(noteId, user.id);
  }

  /**
   * Retrieve the recorded transcript for a completed audio room session.
   * Returns { recording_url, transcript_text } if available.
   */
  @Get(':id/transcript')
  @HttpCode(HttpStatus.OK)
  async getTranscript(
    @Param('id') roomId: string,
  ): Promise<{ recording_url: string | null; transcript_text: string | null }> {
    return this.audioRoomsService.getTranscript(roomId);
  }
}
