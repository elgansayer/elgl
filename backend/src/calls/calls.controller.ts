import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CreateGroupCallDto } from './dto/create-group-call.dto';
import { InitiateCallDto } from './dto/initiate-call.dto';

interface RequestWithUser {
  user?: {
    id?: string;
  };
}

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('initiate')
  async initiateCall(
    @Request() req: RequestWithUser,
    @Body() dto: InitiateCallDto,
  ) {
    // Fallback to a dummy user ID if req.user is not populated in this mock
    const callerId = req.user?.id || 'dummy_caller_id';
    return this.callsService.initiateCall(
      callerId,
      dto.callee_id,
      dto.is_video,
    );
  }

  @Post('group')
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
  getActiveCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCalls(userId);
  }

  @Get('waiting')
  getWaitingCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getWaitingCalls(userId);
  }

  @Put(':room_name/accept-waiting')
  acceptWaitingCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.acceptWaitingCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/hold')
  holdCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.holdCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/resume')
  resumeCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.resumeCall(userId, roomName);
    return { success: true };
  }

  @Put(':room_name/leave')
  leaveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.leaveCall(userId, roomName);
    return { success: true };
  }
}
