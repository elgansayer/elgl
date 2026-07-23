import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';
import { SafetyService } from './safety.service';

@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('report')
  async reportMessage(
    @Req() req: any,
    @Body() dto: ReportUserDto,
  ): Promise<{ success: boolean }> {
    await this.safetyService.reportMessage(req.user.id, dto);
    return { success: true };
  }

  @Post('block')
  async blockUser(@Req() req: any, @Body() dto: BlockUserDto) {
    return this.safetyService.blockUser(req.user.id, dto);
  }

  @Get('blocked-ids')
  async getBlockedIds(@Req() req: any): Promise<string[]> {
    return this.safetyService.getBlockedIds(req.user.id);
  }
}
