import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AudioRoomsService } from './audio-rooms.service';
import {
  ApproveSpeakerDto,
  ArchiveRoomDto,
  CreateAudioRoomDto,
  JoinRoomDto,
  RaiseHandDto,
  SendCaptionDto,
} from './dto/audio-room.dto';
import {
  AudioRoomRecord,
  CaptionRecord,
  RoomTokenResponse,
} from './interfaces/audio-room.interface';

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
}
