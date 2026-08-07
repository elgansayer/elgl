import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
  VideoCallsRateLimit,
  VideoCallsRateLimiterGuard,
} from './video-calls-rate-limiter.guard';

interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Video calls controller with per-user rate limiting to prevent abuse.
 * Start call: max 3 per minute per user.
 * Accept/join call: max 10 per minute per user.
 */
@Controller('video-calls')
@UseGuards(SupabaseAuthGuard, VideoCallsRateLimiterGuard)
export class VideoCallsController {
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Post('start')
  @VideoCallsRateLimit({ maxRequests: 3, windowSeconds: 60 })
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId);
  }

  @Post('accept')
  @VideoCallsRateLimit({ maxRequests: 10, windowSeconds: 60 })
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.joinRoom(userId, roomName);
  }
}
