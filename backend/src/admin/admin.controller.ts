import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
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
}
