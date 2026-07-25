import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CallsService } from './calls.service';
// Assuming a standard auth guard exists based on SPEC.md
// import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@Controller('calls')
// @UseGuards(SupabaseAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('initiate')
  async initiateCall(@Request() req: any, @Body('callee_id') calleeId: string) {
    // Fallback to a dummy user ID if req.user is not populated in this mock
    const callerId = req.user?.id || 'dummy_caller_id';
    return this.callsService.initiateCall(callerId, calleeId);
  }
}
