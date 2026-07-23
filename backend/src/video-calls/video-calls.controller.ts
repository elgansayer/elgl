import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Controller('video-calls')
@UseGuards(SupabaseAuthGuard)
export class VideoCallsController {
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Post('start')
  async startCall(
    @Req() req: AuthenticatedRequest,
    @Body('remoteUserId') remoteUserId: string,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId, remoteUserId);
  }

  @Post('accept')
  async acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.joinRoom(userId, roomName);
  }
}
