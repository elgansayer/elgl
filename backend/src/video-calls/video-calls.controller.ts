<<<<<<< HEAD
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
=======
import { Controller, Post, Body, UseGuards, UseInterceptors, Req } from '@nestjs/common';
>>>>>>> origin/main
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
<<<<<<< HEAD
  StartVideoCallDto,
  JoinVideoCallDto,
  EndVideoCallDto,
  ListActiveRoomsQueryDto,
} from './dto/video-call.dto';
=======
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
>>>>>>> origin/main

interface AuthenticatedRequest extends Request {
  user?: User;
}

@ApiTags('Video Classrooms')
@Controller('video-calls')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class VideoCallsController {
  constructor(private readonly videoCallsService: VideoCallsService) {}

  @Post('start')
<<<<<<< HEAD
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a video classroom or direct call',
    description:
      'Creates a new LiveKit room for a video classroom (group) or direct 1-on-1 call. ' +
      'Returns a LiveKit access token and room name. For direct calls, specify the callee_id. ' +
      'For open classrooms, omit callee_id and set max_participants to the desired capacity (up to 50).',
  })
  @ApiResponse({
    status: 201,
    description: 'Video call room created successfully.',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'eyJ...' },
        room_name: { type: 'string', example: 'video_abc123' },
        is_video: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body or participant limit exceeded.' })
  @ApiResponse({ status: 401, description: 'Unauthorised - missing or invalid bearer token.' })
  async startCall(@Req() req: AuthenticatedRequest, @Body() dto: StartVideoCallDto) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId, dto);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join an existing video classroom',
    description:
      'Generates a LiveKit access token for joining an existing room. ' +
      'The room must exist and the user must be a participant or the room must have capacity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Join token generated successfully.',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'eyJ...' },
        room_name: { type: 'string', example: 'video_abc123' },
        is_video: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async joinCall(
=======
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  async startCall(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.videoCallsService.createRoom(userId);
  }

  @Post('accept')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  acceptCall(
>>>>>>> origin/main
    @Req() req: AuthenticatedRequest,
    @Body() dto: JoinVideoCallDto,
  ) {
    const userId = req.user!.id;
<<<<<<< HEAD
<<<<<<< HEAD
    return this.videoCallsService.joinRoom(userId, dto.room_name);
  }

  @Post('end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End a video classroom',
    description:
      'Ends an active video classroom or call. Only the room creator can end the room. ' +
      'All participants are disconnected from the LiveKit room.',
  })
  @ApiResponse({
    status: 200,
    description: 'Room ended successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        room_name: { type: 'string', example: 'video_abc123' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  @ApiResponse({ status: 403, description: 'Only the room creator can end the room.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async endCall(@Req() req: AuthenticatedRequest, @Body() dto: EndVideoCallDto) {
    const userId = req.user!.id;
    return this.videoCallsService.endRoom(userId, dto.room_name);
  }

  @Get('active')
  @ApiOperation({
    summary: 'List active video classrooms',
    description:
      'Returns all active video classrooms and direct calls, optionally filtered by type, topic, or language pair. ' +
      'Used by the discovery surface to display joinable rooms.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active video classrooms.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_name: { type: 'string', example: 'video_abc123' },
          creator_id: { type: 'string', example: 'uuid' },
          is_video: { type: 'boolean', example: true },
          participant_count: { type: 'number', example: 5 },
          max_participants: { type: 'number', example: 20 },
          topic: { type: 'string', nullable: true, example: 'english' },
          language_pair: { type: 'string', nullable: true, example: 'en-es' },
          created_at: { type: 'string', format: 'date-time', example: '2026-08-07T12:00:00Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  async listActive(@Query() query: ListActiveRoomsQueryDto) {
    return this.videoCallsService.listActiveRooms(query);
  }

  @Get('active/:roomName')
  @ApiOperation({
    summary: 'Get details of a specific active video classroom',
    description:
      'Returns detailed information about a specific active room, including current participant list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Room details with participants.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'video_abc123' },
        creator_id: { type: 'string', example: 'uuid' },
        is_video: { type: 'boolean', example: true },
        participant_count: { type: 'number', example: 5 },
        max_participants: { type: 'number', example: 20 },
        participants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: { type: 'string', example: 'uuid' },
              joined_at: { type: 'string', format: 'date-time', example: '2026-08-07T12:00:00Z' },
            },
          },
        },
        topic: { type: 'string', nullable: true, example: 'english' },
        language_pair: { type: 'string', nullable: true, example: 'en-es' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  getActiveRoom(
    @Req() req: AuthenticatedRequest,
    @Param('roomName') roomName: string,
  ) {
    const userId = req.user!.id;
    return this.videoCallsService.getActiveRoom(userId, roomName);
=======
    const sanitisedRoomName = sanitiseVideoCallsData(roomName);
    return sanitiseVideoCallsData(
      this.videoCallsService.joinRoom(userId, sanitisedRoomName),
    );
>>>>>>> origin/main
=======
    return this.videoCallsService.joinRoom(userId, roomName);
>>>>>>> origin/main
  }
}
