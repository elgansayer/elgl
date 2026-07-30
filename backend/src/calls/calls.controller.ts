import { Controller, Post, Body, Request } from '@nestjs/common';
import { CallsService } from './calls.service';

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
    @Body('callee_id') calleeId: string,
    @Body('is_video') isVideo?: boolean,
  ) {
    // Fallback to a dummy user ID if req.user is not populated in this mock
    const callerId = req.user?.id || 'dummy_caller_id';
    return this.callsService.initiateCall(callerId, calleeId, isVideo);
  }
}
