import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CACHE_NO_STORE,
  CacheControlInterceptor,
} from '../common/cache.interceptor';
import { AudioRoomArchivesService } from './audio-room-archives.service';
import {
  AudioRoomArchiveListItem,
  AudioRoomArchiveSummary,
  FinalizeAudioRoomArchiveResult,
} from './interfaces/audio-room-archive.interface';

interface AuthUser {
  id: string;
}

interface FinalizeArchiveBody {
  recording_url?: string | null;
}

@ApiTags('Audio Room Archives')
@ApiBearerAuth()
@Controller('audio-room-archives')
@UseGuards(SupabaseAuthGuard)
@UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
export class AudioRoomArchivesController {
  constructor(private readonly archives: AudioRoomArchivesService) {}

  @Get()
  @ApiOperation({
    summary: 'List archived audio rooms for the authenticated participant',
  })
  async list(
    @CurrentUser() user: AuthUser | null,
  ): Promise<AudioRoomArchiveListItem[]> {
    if (!user) return [];
    return this.archives.listArchives(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get recording, transcript and AI session summary for an archive',
  })
  async getSummary(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
  ): Promise<AudioRoomArchiveSummary | null> {
    if (!user) return null;
    return this.archives.getSummary(user.id, roomId);
  }

  @Post(':id/participation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Record authenticated participation in an audio room',
  })
  async recordParticipation(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
  ): Promise<void> {
    if (!user) return;
    await this.archives.recordParticipation(user.id, roomId);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Archive a hosted room and enqueue transcript/session summary work',
  })
  async finalize(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
    @Body() body: FinalizeArchiveBody,
  ): Promise<FinalizeAudioRoomArchiveResult | null> {
    if (!user) return null;
    return this.archives.finalizeRoom(user.id, roomId, body.recording_url);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry a failed archived-room session summary' })
  async retry(
    @CurrentUser() user: AuthUser | null,
    @Param('id') roomId: string,
  ): Promise<{ queued: boolean }> {
    if (!user) return { queued: false };
    await this.archives.retrySummary(user.id, roomId);
    return { queued: true };
  }
}
