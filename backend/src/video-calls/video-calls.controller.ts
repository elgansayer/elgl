import { Controller, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
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
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Post('start')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId);
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.joinRoom(userId, roomName);
  }
}
