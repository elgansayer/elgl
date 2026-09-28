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
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { StartVideoCallDto } from './dto/start-video-call.dto';
import { AcceptVideoCallDto } from './dto/accept-video-call.dto';

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
    summary: 'Start a new encrypted call room',
    description:
      'Creates a new two-participant LiveKit call room for the authenticated user and intended recipient. ' +
      'The response includes short-lived E2EE key material delivered outside the LiveKit media plane. ' +
      'The room is configured with a 30-second empty timeout and a maximum of 2 participants.',
  })
  @ApiResponse({
    status: 201,
    description: 'Encrypted call room created successfully.',
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
          example: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        },
        e2eeKey: {
          type: 'string',
          description:
            'Ephemeral key material used by the clients for LiveKit media E2EE. Never persist or log this value.',
        },
        degraded: {
          type: 'boolean',
          description:
            'Whether the LiveKit control-plane response used a degraded fallback',
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
  @ApiResponse({ status: 400, description: 'Invalid intended participant.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 503,
    description: 'Encrypted call key broker unavailable.',
  })
  async startCall(
    @Req() req: AuthenticatedRequest,
    @Body() body: StartVideoCallDto,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId, body.remoteUserId);
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Accept and join an encrypted call room',
    description:
      'Generates a LiveKit access token only when the authenticated user is an intended participant ' +
      'and returns the same short-lived E2EE key created for the call. Knowledge of a room name alone is insufficient.',
  })
  @ApiResponse({
    status: 201,
    description: 'Encrypted call join material generated successfully.',
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
          example: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
        },
        e2eeKey: {
          type: 'string',
          description:
            'Ephemeral key material used by the clients for LiveKit media E2EE. Never persist or log this value.',
        },
        degraded: {
          type: 'boolean',
          description:
            'Whether the LiveKit control-plane response used a degraded fallback',
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
  @ApiResponse({ status: 400, description: 'Invalid room name.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Call unavailable or user is not a participant.',
  })
  @ApiResponse({
    status: 503,
    description: 'Encrypted call key broker unavailable.',
  })
  acceptCall(
    @Req() req: AuthenticatedRequest,
    @Body() body: AcceptVideoCallDto,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.joinRoom(userId, body.roomName);
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
