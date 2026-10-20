import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlockUserDto, ReportUserDto, UnblockUserDto } from './dto/safety.dto';
import { BlockedUserResponseDto } from './dto/blocked-user.dto';
import { SafetyService } from './safety.service';

@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Get('report-categories')
  getReportCategories() {
    return this.safetyService.getCategories();
  }

  @Post('report')
  async reportUser(
    @Req() req: { user: { id: string } },
    @Body() dto: ReportUserDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.safetyService.reportUser(req.user.id, dto);
    return { success: true, message: 'Report submitted successfully' };
  }

  @Post('block')
  async blockUser(
    @Req() req: { user: { id: string } },
    @Body() dto: BlockUserDto,
  ): Promise<{ success: boolean; blocked_id: string }> {
    return this.safetyService.blockUser(req.user.id, dto);
  }

  @Post('unblock')
  async unblockUser(
    @Req() req: { user: { id: string } },
    @Body() dto: UnblockUserDto,
  ): Promise<{ success: boolean }> {
    return this.safetyService.unblockUser(req.user.id, dto.blocked_id);
  }

  @Get('blocked-ids')
  async getBlockedIds(@Req() req: { user: { id: string } }): Promise<string[]> {
    return this.safetyService.getBlockedUserIds(req.user.id);
  }

  @Get('blocked-users')
  async getBlockedUsers(
    @Req() req: { user: { id: string } },
  ): Promise<string[]> {
    return this.safetyService.getBlockedUserIds(req.user.id);
  }

  @Get('blocked-ids/:userId')
  async getBlockedUserIds(@Param('userId') userId: string): Promise<string[]> {
    return this.safetyService.getBlockedUserIds(userId);
  }

  @Get('blocker-ids/:userId')
  async getBlockerUserIds(@Param('userId') userId: string): Promise<string[]> {
    return this.safetyService.getBlockerUserIds(userId);
  }

  @Get('is-blocked/:blockedId')
  async isBlocked(
    @Req() req: { user: { id: string } },
    @Param('blockedId') blockedId: string,
  ): Promise<{ blocked: boolean }> {
    const blocked = await this.safetyService.isBlocked(req.user.id, blockedId);
    return { blocked };
  }

  @Post('block/:blockedId')
  async blockUserByParam(
    @Req() req: { user: { id: string } },
    @Param('blockedId') blockedId: string,
  ): Promise<{ success: boolean; blocked_id: string }> {
    return this.safetyService.blockUser(req.user.id, { blocked_id: blockedId });
  }

  @Post('unblock/:blockedId')
  async unblockUserByParam(
    @Req() req: { user: { id: string } },
    @Param('blockedId') blockedId: string,
  ): Promise<{ success: boolean }> {
    return this.safetyService.unblockUser(req.user.id, blockedId);
  }

  @Get('blocked-and-blocker-ids/:userId')
  async getBlockedAndBlockerIds(
    @Param('userId') userId: string,
  ): Promise<string[]> {
    return this.safetyService.getBlockedAndBlockerIds(userId);
  }

  @Get('blocked-users-details')
  async getBlockedUserDetails(
    @Req() req: { user: { id: string } },
  ): Promise<BlockedUserResponseDto[]> {
    return this.safetyService.getBlockedUserDetails(req.user.id);
  }
}
