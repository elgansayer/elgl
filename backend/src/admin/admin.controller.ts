import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';

interface AuthRequest extends Request {
  user: { sub: string };
}

@Controller('admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(
    @Query() query: AdminUserQueryDto,
  ): Promise<AdminUserListResult> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/vip')
  async setVipStatus(
    @Param('id') id: string,
    @Body() dto: ToggleVipDto,
  ): Promise<AdminUserSummary> {
    return this.adminService.setVipStatus(id, dto);
  }

  @Get('users/:id/login-history')
  async getLoginHistory(@Param('id') id: string): Promise<LoginHistoryEntry[]> {
    return this.adminService.getLoginHistory(id);
  }

  @Post('users/:id/ban')
  async banUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.banUser(id, adminUserId);
    return { message: 'User banned' };
  }

  @Post('users/:id/warn')
  async warnUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.warnUser(id, adminUserId);
    return { message: 'User warned' };
  }

  @Get('blocks')
  async listBlockedUsers(): Promise<any[]> {
    return this.adminService.listBlockedUsers();
  }

  @Delete('blocks/:blockedId')
  async adminUnblockUser(
    @Param('blockedId') blockedId: string,
  ): Promise<{ message: string }> {
    await this.adminService.adminUnblockUser(blockedId);
    return { message: 'User unblocked' };
  }
}
