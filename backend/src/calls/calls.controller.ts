import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CallsService } from './calls.service';
import { CreateGroupCallDto } from './dto/create-group-call.dto';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { SwitchCallDto } from './dto/switch-call.dto';

interface RequestWithUser {
  user?: {
    id?: string;
  };
}

@ApiTags('Video Classrooms')
@Controller('calls')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Initiate a 1-on-1 call',
    description:
      'Creates a new LiveKit room for a direct 1-on-1 call (video or audio). ' +
      'Returns LiveKit tokens for both caller and callee. If the callee is busy in another ' +
      'call, the call will be placed in a waiting queue.',
  })
  @ApiResponse({
    status: 201,
    description: 'Call initiated successfully.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'call_abc123' },
        caller_token: { type: 'string', example: 'eyJ...' },
        callee_token: { type: 'string', example: 'eyJ...' },
        e2ee_key: { type: 'string', example: 'base64key...' },
        is_video: { type: 'boolean', example: true },
        call_id: { type: 'string', example: 'uuid' },
        waiting: { type: 'boolean', example: false },
        encryption: { type: 'string', example: 'e2ee' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
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
  @ApiOperation({
    summary: 'Create a group video call',
    description:
      'Creates a new LiveKit room for a group conversation with multiple participants. ' +
      'Supports up to 50 participants with end-to-end encryption.',
  })
  @ApiResponse({
    status: 201,
    description: 'Group call created successfully.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'group_abc123' },
        tokens: { type: 'array', items: { type: 'string' }, example: ['eyJ...', 'eyJ...'] },
        e2ee_key: { type: 'string', example: 'base64key...' },
        is_video: { type: 'boolean', example: true },
        call_id: { type: 'string', example: 'uuid' },
        participant_limit: { type: 'number', example: 10 },
        encryption: { type: 'string', example: 'e2ee' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Participant limit exceeded or invalid count.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
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
  @ApiOperation({
    summary: 'List active calls for the current user',
    description:
      'Returns all active calls the current user is participating in, including held calls.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active calls.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_name: { type: 'string', example: 'call_abc123' },
          is_held: { type: 'boolean', example: false },
          e2ee_key: { type: 'string', nullable: true, example: 'base64key...' },
          is_video: { type: 'boolean', example: true },
          participant_limit: { type: 'number', nullable: true, example: 10 },
          is_group: { type: 'boolean', example: false },
          callee_token: { type: 'string', nullable: true, example: 'eyJ...' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  getActiveCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCalls(userId);
  }

  @Get('active/:room_name')
  @ApiOperation({
    summary: 'Get details of a specific active call',
    description: 'Returns detailed information about a specific active call by room name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Call details.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'call_abc123' },
        is_held: { type: 'boolean', example: false },
        e2ee_key: { type: 'string', nullable: true, example: 'base64key...' },
        is_video: { type: 'boolean', example: true },
        participant_limit: { type: 'number', nullable: true, example: 10 },
        is_group: { type: 'boolean', example: false },
        callee_token: { type: 'string', nullable: true, example: 'eyJ...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  getActiveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCall(userId, roomName);
  }

  @Get('waiting')
  @ApiOperation({
    summary: 'List waiting calls for the current user',
    description:
      'Returns calls where the current user is the callee and has not yet answered. ' +
      'Users may have multiple waiting calls from different callers.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of waiting calls.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          room_name: { type: 'string', example: 'call_abc123' },
          callee_token: { type: 'string', example: 'eyJ...' },
          e2ee_key: { type: 'string', example: 'base64key...' },
          is_video: { type: 'boolean', example: true },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  getWaitingCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getWaitingCalls(userId);
  }

  @Put('switch')
  @ApiOperation({
    summary: 'Switch between calls',
    description:
      'Puts the current active call on hold and switches to a waiting call. ' +
      'Returns the target call details and the held call room name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Switched successfully.',
    schema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', example: 'call_xyz789' },
        callee_token: { type: 'string', example: 'eyJ...' },
        e2ee_key: { type: 'string', example: 'base64key...' },
        is_video: { type: 'boolean', example: true },
        held_call_room_name: { type: 'string', example: 'call_abc123' },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found or cannot switch.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  switchCall(@Request() req: RequestWithUser, @Body() dto: SwitchCallDto) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.switchCall(
      userId,
      dto.current_room_name,
      dto.target_room_name,
    );
  }

  @Put(':room_name/accept-waiting')
  @ApiOperation({
    summary: 'Accept a waiting call',
    description:
      'Accepts a waiting call by room name. Any current active calls will be placed on hold.',
  })
  @ApiResponse({
    status: 200,
    description: 'Waiting call accepted.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No waiting calls or call not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  acceptWaitingCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.acceptWaitingCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/hold')
  @ApiOperation({
    summary: 'Put a call on hold',
    description: 'Places an active call on hold without disconnecting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Call placed on hold.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  holdCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.holdCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/resume')
  @ApiOperation({
    summary: 'Resume a held call',
    description: 'Resumes a call that was previously placed on hold.',
  })
  @ApiResponse({
    status: 200,
    description: 'Call resumed.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Call not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  resumeCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.resumeCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/leave')
  @ApiOperation({
    summary: 'Leave a call',
    description: 'Leaves an active call, removing the user from the room.',
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
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  leaveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.leaveCall(userId, roomName);
    return { success: true };
  }
}
