import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { CallsService } from './calls.service';
import { CreateGroupCallDto } from './dto/create-group-call.dto';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { SwitchCallDto } from './dto/switch-call.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_EDGE_SHORT,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
  CACHE_TAG_CALLS,
} from '../common/cache.interceptor';

interface RequestWithUser {
  user?: {
    id?: string;
  };
}

@ApiTags('Video Classrooms')
@Controller('calls')
@ApiBearerAuth()
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    @InjectPinoLogger(CallsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('initiate')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Initiate a 1:1 video or audio call',
    description:
      'Initiates a new call between the caller and the specified callee. ' +
      'Creates a LiveKit room with a max of 2 participants, generates an E2EE key, ' +
      'and returns access tokens for both participants. If the callee is already in ' +
      'an active call, the call is placed in the waiting queue.',
  })
  @ApiResponse({
    status: 201,
    description: 'Call initiated successfully.',
    schema: {
      type: 'object',
      properties: {
        room_name: {
          type: 'string',
          description: 'LiveKit room name',
          example: 'call_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
        caller_token: {
          type: 'string',
          description: 'LiveKit access token for the caller',
          example: 'eyJhbGciOi...',
        },
        callee_token: {
          type: 'string',
          description: 'LiveKit access token for the callee',
          example: 'eyJhbGciOi...',
        },
        e2ee_key: {
          type: 'string',
          description: 'Base64-encoded E2EE key for end-to-end encryption',
          example: 'dGhpcyBpcyBhIDMyLWJ5dGUgZW5jcnlwdGlvbiBrZXk=',
        },
        is_video: {
          type: 'boolean',
          description: 'Whether this is a video call',
          example: true,
        },
        call_id: {
          type: 'string',
          description: 'Unique call identifier',
          example: 'f9e8d7c6-b5a4-3210-fedc-ba0987654321',
        },
        waiting: {
          type: 'boolean',
          description:
            'Whether the callee is busy and the call has been queued',
          example: false,
        },
        encryption: {
          type: 'string',
          description: 'Encryption type used',
          example: 'e2ee',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid callee ID.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async initiateCall(
    @Request() req: RequestWithUser,
    @Body() dto: InitiateCallDto,
  ) {
    const callerId = req.user?.id || 'dummy_caller_id';
    return this.callsService.initiateCall(
      callerId,
      dto.callee_id,
      dto.is_video,
    );
  }

  @Post('group')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a group video call',
    description:
      'Creates a new group video call with the specified participants. ' +
      'The caller is automatically added to the participant list if not already included. ' +
      'Sets up a LiveKit room with the configured participant limit and E2EE encryption.',
  })
  @ApiResponse({
    status: 201,
    description: 'Group call created successfully.',
    schema: {
      type: 'object',
      properties: {
        room_name: {
          type: 'string',
          description: 'LiveKit room name',
          example: 'group_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
        tokens: {
          type: 'array',
          items: { type: 'string' },
          description: 'LiveKit access tokens for all participants',
          example: ['eyJhbG...', 'eyJhbG...'],
        },
        e2ee_key: {
          type: 'string',
          description: 'Base64-encoded E2EE key',
          example: 'dGhpcyBpcyBhIDMyLWJ5dGUgZW5jcnlwdGlvbiBrZXk=',
        },
        is_video: {
          type: 'boolean',
          description: 'Whether this is a video call',
          example: true,
        },
        call_id: {
          type: 'string',
          description: 'Unique call identifier',
          example: 'f9e8d7c6-b5a4-3210-fedc-ba0987654321',
        },
        participant_limit: {
          type: 'number',
          description: 'Maximum participant count',
          example: 10,
        },
        encryption: {
          type: 'string',
          description: 'Encryption type used',
          example: 'e2ee',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - participant limit exceeded or invalid count.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createGroupCall(
    @Request() req: RequestWithUser,
    @Body() dto: CreateGroupCallDto,
  ) {
    const callerId = req.user?.id || 'dummy_caller_id';
    const participantIds = dto.participant_ids;
    const limit = dto.participant_limit;
    return this.callsService.createGroupCall(callerId, participantIds, limit);
  }

  @Get('active')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]),
  )
  @ApiOperation({
    summary: 'List active calls for the current user',
    description:
      'Returns all active calls for the authenticated user, including held calls. ' +
      'Each call entry includes room name, hold status, E2EE key, video flag, and participant info. ' +
      'Responses are cached at CDN edge for short duration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of active calls.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_name: { type: 'string', example: 'call_abc123' },
          is_held: { type: 'boolean', example: false },
          e2ee_key: { type: 'string', nullable: true, example: 'dGhpcyBp...' },
          is_video: { type: 'boolean', example: true },
          participant_limit: { type: 'number', nullable: true, example: 2 },
          is_group: { type: 'boolean', example: false },
          callee_token: { type: 'string', nullable: true, example: null },
        },
      },
    },
  })
  getActiveCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCalls(userId);
  }

  @Get('active/:room_name')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]),
  )
  @ApiOperation({
    summary: 'Get details of a specific active call',
    description:
      'Returns details for a specific active call identified by room name. ' +
      "Throws 400 if the call is not found in the user's active calls.",
  })
  @ApiParam({
    name: 'room_name',
    description: 'LiveKit room name',
    example: 'call_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Active call details.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'call_abc123' },
        is_held: { type: 'boolean', example: false },
        e2ee_key: { type: 'string', nullable: true, example: 'dGhpcyBp...' },
        is_video: { type: 'boolean', example: true },
        participant_limit: { type: 'number', nullable: true, example: 2 },
        is_group: { type: 'boolean', example: false },
        callee_token: { type: 'string', nullable: true, example: null },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  getActiveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCall(userId, roomName);
  }

  @Get('waiting')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]),
  )
  @ApiOperation({
    summary: 'List waiting (queued) calls for the current user',
    description:
      'Returns all calls where the authenticated user is the callee and has not yet answered. ' +
      'Each entry includes room name, callee token, E2EE key, and video flag.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of waiting calls.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_name: { type: 'string', example: 'call_abc123' },
          callee_token: { type: 'string', example: 'eyJhbGci...' },
          e2ee_key: { type: 'string', example: 'dGhpcyBp...' },
          is_video: { type: 'boolean', example: true },
        },
      },
    },
  })
  getWaitingCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getWaitingCalls(userId);
  }

  @Put('switch')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Switch between calls (place current on hold, accept waiting)',
    description:
      'Places the current active call on hold and accepts a waiting call. ' +
      'Both calls must belong to the authenticated user. ' +
      "Returns the target call details and the held call's room name.",
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully switched calls.',
    schema: {
      type: 'object',
      properties: {
        room_name: {
          type: 'string',
          description: 'Target room name (the waiting call being answered)',
          example: 'call_waiting123',
        },
        callee_token: {
          type: 'string',
          description: 'Callee token for the target call',
          example: 'eyJhbGci...',
        },
        e2ee_key: {
          type: 'string',
          description: 'E2EE key for the target call',
          example: 'dGhpcyBp...',
        },
        is_video: {
          type: 'boolean',
          description: 'Whether the target call is video',
          example: true,
        },
        held_call_room_name: {
          type: 'string',
          description: 'Room name of the call placed on hold',
          example: 'call_current123',
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - call not found, same call, or no waiting calls.',
  })
  switchCall(@Request() req: RequestWithUser, @Body() dto: SwitchCallDto) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.switchCall(
      userId,
      dto.current_room_name,
      dto.target_room_name,
    );
  }

  @Put(':room_name/accept-waiting')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Accept a waiting call',
    description:
      'Accepts a specific waiting call for the authenticated user. ' +
      'Any other active calls are placed on hold before accepting the waiting call.',
  })
  @ApiParam({
    name: 'room_name',
    description: 'LiveKit room name of the waiting call to accept',
    example: 'call_waiting123',
  })
  @ApiResponse({
    status: 200,
    description: 'Waiting call accepted successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Waiting call not found or no waiting calls.',
  })
  acceptWaitingCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.acceptWaitingCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/hold')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Place an active call on hold',
    description:
      'Places the specified active call on hold for the authenticated user. ' +
      'The call remains active but is marked as held.',
  })
  @ApiParam({
    name: 'room_name',
    description: 'LiveKit room name of the call to place on hold',
    example: 'call_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Call placed on hold successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  holdCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.holdCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/resume')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Resume a held call',
    description:
      'Resumes a call that was previously placed on hold by the authenticated user. ' +
      'Marks the call as no longer held.',
  })
  @ApiParam({
    name: 'room_name',
    description: 'LiveKit room name of the held call to resume',
    example: 'call_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Call resumed successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  resumeCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.resumeCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/leave')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Leave an active call',
    description:
      'Removes the authenticated user from the specified active call. ' +
      "If this was the user's last active call, their entire call map is cleaned up.",
  })
  @ApiParam({
    name: 'room_name',
    description: 'LiveKit room name of the call to leave',
    example: 'call_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Left call successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  leaveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.leaveCall(userId, roomName);
    return { success: true };
  }
}
