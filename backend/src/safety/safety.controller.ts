import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Param,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlockUserDto, ReportUserDto, UnblockUserDto } from './dto/safety.dto';
import { BlockedUserResponseDto } from './dto/blocked-user.dto';
import { BlockResult, SafetyCategory, SafetyService } from './safety.service';

/** Public response for a report. `duplicate` marks an already-open report. */
export interface ReportSubmissionResponse {
  success: boolean;
  message: string;
  report_id: string;
  duplicate: boolean;
}

/**
 * Block and report endpoints for personal and business accounts. Every route
 * requires an authenticated caller and only ever acts on that caller's own
 * trust graph. Mutations are throttled and validated before they reach the
 * service.
 */
@Controller('safety')
@UseGuards(SupabaseAuthGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Get('report-categories')
  getReportCategories(): SafetyCategory[] {
    return this.safetyService.getCategories();
  }

  @Post('report')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reportUser(
    @Req() req: { user: { id: string } },
    @Body() dto: ReportUserDto,
  ): Promise<ReportSubmissionResponse> {
    const result = await this.safetyService.reportUser(req.user.id, dto);
    return {
      success: true,
      message: 'Report submitted successfully',
      report_id: result.id,
      duplicate: result.duplicate,
    };
  }

  @Post('block')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async blockUser(
    @Req() req: { user: { id: string } },
    @Body() dto: BlockUserDto,
  ): Promise<BlockResult> {
    return this.safetyService.blockUser(req.user.id, dto);
  }

  @Post('unblock')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
  async getBlockedUserIds(
    @Req() req: { user: { id: string } },
    @Param('userId') userId: string,
  ): Promise<string[]> {
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only view your own blocked users');
    }
    return this.safetyService.getBlockedUserIds(userId);
  }

  @Get('blocker-ids/:userId')
  async getBlockerUserIds(
    @Req() req: { user: { id: string } },
    @Param('userId') userId: string,
  ): Promise<string[]> {
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only view your own blockers');
    }
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async blockUserByParam(
    @Req() req: { user: { id: string } },
    @Param('blockedId', new ParseUUIDPipe()) blockedId: string,
  ): Promise<BlockResult> {
    return this.safetyService.blockUser(req.user.id, { blocked_id: blockedId });
  }

  @Post('unblock/:blockedId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async unblockUserByParam(
    @Req() req: { user: { id: string } },
    @Param('blockedId', new ParseUUIDPipe()) blockedId: string,
  ): Promise<{ success: boolean }> {
    return this.safetyService.unblockUser(req.user.id, blockedId);
  }

  @Get('blocked-and-blocker-ids/:userId')
  async getBlockedAndBlockerIds(
    @Req() req: { user: { id: string } },
    @Param('userId') userId: string,
  ): Promise<string[]> {
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only view your own block lists');
    }
    return this.safetyService.getBlockedAndBlockerIds(userId);
  }

  @Get('blocked-users-details')
  async getBlockedUserDetails(
    @Req() req: { user: { id: string } },
  ): Promise<BlockedUserResponseDto[]> {
    return this.safetyService.getBlockedUserDetails(req.user.id);
  }
}
