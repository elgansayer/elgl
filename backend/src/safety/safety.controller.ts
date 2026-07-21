import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';
import { SafetyService } from './safety.service';

@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('report')
  async reportUser(
    @CurrentUser() user: User | null,
    @Body() dto: ReportUserDto,
  ) {
    if (!user) return null;
    return await this.safetyService.reportUser(user.id, dto);
  }

  @Post('block')
  async blockUser(@CurrentUser() user: User | null, @Body() dto: BlockUserDto) {
    if (!user) return null;
    return await this.safetyService.blockUser(user.id, dto);
  }

  @Get('blocked-ids')
  async getBlockedIds(@CurrentUser() user: User | null): Promise<string[]> {
    if (!user) return [];
    return await this.safetyService.getBlockedIds(user.id);
  }
}
