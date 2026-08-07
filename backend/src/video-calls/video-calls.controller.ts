import { Controller, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@ApiTags('Video Classrooms')
@Controller('video-calls')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class VideoCallsController {
  constructor(
    private readonly videoCallsService: VideoCallsService,
    @InjectPinoLogger(VideoCallsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('start')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Start a new video call room',
    description:
      'Creates a new LiveKit video call room for the authenticated user. ' +
      'Returns a LiveKit access token and the generated room name. ' +
      'The room is configured with a 30-second empty timeout and a maximum of 2 participants.',
  })
  @ApiResponse({
    status: 201,
    description: 'Video call room created successfully.',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'LiveKit access token for the caller',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        roomName: {
          type: 'string',
          description: 'Generated LiveKit room name',
          example: 'video_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
<<<<<<< HEAD
    this.logger.info({ userId }, `Video call start requested by user ${userId}`);
    return sanitiseVideoCallsData(
      await this.videoCallsService.createRoom(userId),
    );
=======
    return this.videoCallsService.createRoom(userId);
>>>>>>> origin/main
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Accept and join an existing video call room',
    description:
      'Generates a LiveKit access token for the authenticated user to join ' +
      'an existing video call room identified by its room name.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['roomName'],
      properties: {
        roomName: {
          type: 'string',
          description: 'The LiveKit room name to join',
          example: 'video_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Token generated successfully for joining the room.',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'LiveKit access token for the participant',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        roomName: {
          type: 'string',
          description: 'The LiveKit room name',
          example: 'video_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
<<<<<<< HEAD
    const sanitisedRoomName = sanitiseVideoCallsData(roomName);
    this.logger.info(
      { userId, roomName: sanitisedRoomName },
      `User ${userId} accepting video call in room "${sanitisedRoomName}"`,
    );
    return sanitiseVideoCallsData(
      this.videoCallsService.joinRoom(userId, sanitisedRoomName),
    );
=======
    return this.videoCallsService.joinRoom(userId, roomName);
>>>>>>> origin/main
  }
}
