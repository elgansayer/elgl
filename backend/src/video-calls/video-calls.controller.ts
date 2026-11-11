import {
  Controller,
  Post,
  Put,
  Body,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
} from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { VideoExchangeTimerService } from './video-exchange-timer.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { StartVideoCallDto } from './dto/start-video-call.dto';
import { AcceptVideoCallDto } from './dto/accept-video-call.dto';
import { AdvanceExchangeTimerDto } from './dto/advance-exchange-timer.dto';
import {
  VideoCallsRateLimit,
  VideoCallsRateLimiterGuard,
} from './video-calls-rate-limiter.guard';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@ApiTags('Video Classrooms')
@Controller('video-calls')
@UseGuards(SupabaseAuthGuard, VideoCallsRateLimiterGuard)
@ApiBearerAuth()
export class VideoCallsController {
  constructor(
    private readonly videoCallsService: VideoCallsService,
    private readonly degradationService: VideoCallsDegradationService,
    private readonly exchangeTimerService: VideoExchangeTimerService,
  ) {}

  @Post('start')
  @VideoCallsRateLimit({ maxRequests: 3, windowSeconds: 60 })
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
  @VideoCallsRateLimit({ maxRequests: 10, windowSeconds: 60 })
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

  @Get(':roomName/exchange-timer')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get the 50/50 exchange turn timer for a 1:1 call',
    description:
      'Returns the current speaking turn, language pair and remaining seconds for the authenticated ' +
      'participant. Turn handovers are calculated server-side so a client cannot extend its own turn.',
  })
  @ApiParam({
    name: 'roomName',
    description: 'LiveKit room name of the 1:1 call',
    example: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange timer state for the authenticated participant.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Call is unavailable or user is not a participant.',
  })
  @ApiResponse({
    status: 503,
    description: 'Exchange timer state is temporarily unavailable.',
  })
  getExchangeTimer(
    @Req() req: AuthenticatedRequest,
    @Param('roomName') roomName: string,
  ) {
    return this.exchangeTimerService.getStatus(roomName, req.user!.id);
  }

  @Put(':roomName/exchange-timer/advance')
  @VideoCallsRateLimit({ maxRequests: 30, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'End the current speaking turn early',
    description:
      'Allows the current speaker to hand the turn to the other participant before the timer expires. ' +
      'The expected turn index makes retries idempotent and rejects conflicting concurrent advances.',
  })
  @ApiParam({
    name: 'roomName',
    description: 'LiveKit room name of the 1:1 call',
    example: 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated exchange timer state.',
  })
  @ApiResponse({
    status: 400,
    description: 'The turn has not started or the turn index is invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the current speaker may end the turn.',
  })
  @ApiResponse({
    status: 503,
    description: 'Exchange timer state is temporarily unavailable.',
  })
  advanceExchangeTimer(
    @Req() req: AuthenticatedRequest,
    @Param('roomName') roomName: string,
    @Body() body: AdvanceExchangeTimerDto,
  ) {
    return this.exchangeTimerService.advanceTurn(
      roomName,
      req.user!.id,
      body.expectedTurnIndex,
    );
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
