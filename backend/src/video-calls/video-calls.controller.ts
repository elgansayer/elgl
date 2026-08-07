import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { sanitiseVideoCallsData } from './sanitise-video-calls.helper';
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
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return sanitiseVideoCallsData(
      await this.videoCallsService.createRoom(userId),
    );
  }

  @Post('accept')
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    const sanitisedRoomName = sanitiseVideoCallsData(roomName);
    return sanitiseVideoCallsData(
      this.videoCallsService.joinRoom(userId, sanitisedRoomName),
    );
  }
}
