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
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  AdminBlocksListResult,
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listUsers(
    @Query() query: AdminUserQueryDto,
  ): Promise<AdminUserListResult> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/vip')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setVipStatus(
    @Param('id') id: string,
    @Body() dto: ToggleVipDto,
  ): Promise<AdminUserSummary> {
    return this.adminService.setVipStatus(id, dto);
  }

  @Get('users/:id/login-history')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async getLoginHistory(@Param('id') id: string): Promise<LoginHistoryEntry[]> {
    return this.adminService.getLoginHistory(id);
  }

  @Post('users/:id/ban')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async banUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.banUser(id, adminUserId);
    return { message: 'User banned' };
  }

  @Post('users/:id/warn')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async warnUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.warnUser(id, adminUserId);
    return { message: 'User warned' };
  }

  @Get('blocks')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async listAllBlocks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<AdminBlocksListResult> {
    return this.adminService.listAllBlocks(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Delete('blocks/:blockId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async removeBlock(
    @Param('blockId') blockId: string,
  ): Promise<{ success: boolean }> {
    return this.adminService.removeBlock(blockId);
  }
}
