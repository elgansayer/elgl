import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';

@Controller('video-calls')
@UseGuards(SupabaseAuthGuard)
export class VideoCallsController {
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Post('start')
  async startCall(
    @Req() req: Request,
    @Body('remoteUserId') remoteUserId: string,
  ) {
    const userId = (req as any).user.id;
    return this.videoCallsService.createRoom(userId, remoteUserId);
  }

  @Post('accept')
  async acceptCall(@Req() req: Request, @Body('roomName') roomName: string) {
    const userId = (req as any).user.id;
    return this.videoCallsService.joinRoom(userId, roomName);
  }
}
