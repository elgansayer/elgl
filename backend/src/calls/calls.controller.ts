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

@Controller('calls')
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    @InjectPinoLogger(CallsController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('initiate')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
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
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
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
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]))
  getActiveCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCalls(userId);
  }

  @Get('active/:room_name')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]))
  getActiveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getActiveCall(userId, roomName);
  }

  @Get('waiting')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_CALLS]))
  getWaitingCalls(@Request() req: RequestWithUser) {
    const userId = req.user?.id || 'dummy_caller_id';
    return this.callsService.getWaitingCalls(userId);
  }

  @Put('switch')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
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
  leaveCall(
    @Request() req: RequestWithUser,
    @Param('room_name') roomName: string,
  ) {
    const userId = req.user?.id || 'dummy_caller_id';
    this.callsService.leaveCall(userId, roomName);
    return { success: true };
  }
}
