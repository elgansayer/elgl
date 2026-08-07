import { Controller, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { sanitiseVideoCallsData } from './sanitise-video-calls.helper';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('video-calls')
@UseGuards(SupabaseAuthGuard)
export class VideoCallsController {
  constructor(
    private readonly videoCallsService: VideoCallsService,
    @InjectPinoLogger(VideoCallsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('start')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    this.logger.info({ userId }, `Video call start requested by user ${userId}`);
    return sanitiseVideoCallsData(
      await this.videoCallsService.createRoom(userId),
    );
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    const sanitisedRoomName = sanitiseVideoCallsData(roomName);
    this.logger.info(
      { userId, roomName: sanitisedRoomName },
      `User ${userId} accepting video call in room "${sanitisedRoomName}"`,
    );
    return sanitiseVideoCallsData(
      this.videoCallsService.joinRoom(userId, sanitisedRoomName),
    );
  }
}
