import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
} from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
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
    private readonly degradationService: VideoCallsDegradationService,
  ) {}

  @Post('start')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Start a new video call room',
    description:
      'Creates a new LiveKit video call room for the authenticated user. ' +
      'Returns a LiveKit access token and the generated room name. ' +
      'The room is configured with a 30-second empty timeout and a maximum of 2 participants. ' +
      'When LiveKit is degraded, returns a standalone token with a degraded flag.',
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
        degraded: {
          type: 'boolean',
          description:
            'Whether the response was served from a degraded fallback',
          example: false,
        },
        degradationReason: {
          type: 'string',
          description: 'Human-readable reason for degradation, if degraded',
          example: 'Service livekit failed: Connection refused',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId);
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Accept and join an existing video call room',
    description:
      'Generates a LiveKit access token for the authenticated user to join ' +
      'an existing video call room identified by its room name. ' +
      'When LiveKit is degraded, falls back to cached or standalone tokens.',
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
        degraded: {
          type: 'boolean',
          description:
            'Whether the response was served from a degraded fallback',
          example: false,
        },
        degradationReason: {
          type: 'string',
          description: 'Human-readable reason for degradation, if degraded',
          example: 'Service livekit failed: timeout',
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
    return this.videoCallsService.joinRoom(userId, roomName);
  }

  @Get('health')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Check video classroom service health',
    description:
      'Returns the current health status of the LiveKit video classroom service ' +
      'including circuit breaker states and recent degradation events.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status of the video classroom service.',
  })
  async health() {
    const breakerStates = this.degradationService.getAllBreakerStates();
    const breakers: Record<
      string,
      {
        isOpen: boolean;
        failureCount: number;
        totalFailures: number;
        totalSuccesses: number;
      }
    > = {};
    for (const [name, state] of breakerStates) {
      breakers[name] = {
        isOpen: state.isOpen,
        failureCount: state.failureCount,
        totalFailures: state.totalFailures,
        totalSuccesses: state.totalSuccesses,
      };
    }
    const recentEvents =
      await this.degradationService.getRecentDegradationEvents(10);

    return {
      status: Object.values(breakers).some((b) => b.isOpen)
        ? 'degraded'
        : 'healthy',
      breakers,
      recentDegradationEvents: recentEvents,
    };
  }
}
