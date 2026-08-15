import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminService } from './admin.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';
import {
  AdminUserListResult,
  AdminUserSummary,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string; email?: string };
}

@ApiTags('Admin v1')
@ApiBearerAuth('bearer')
@Controller('admin/v1')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminV1Controller {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly adminService: AdminService,
    private readonly userDetailService: AdminUserDetailService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary:
      'Return the authenticated admin context and effective capabilities',
  })
  @ApiOkResponse({ description: 'Admin context returned successfully' })
  async getMe(@Req() req: AdminAuthRequest) {
    const userId = req.user.id ?? req.user.sub;
    const capabilities = userId
      ? await this.authorization.getEffectiveCapabilities(userId)
      : [];

    return {
      user: {
        id: userId,
        email: req.user.email ?? null,
      },
      capabilities,
      authorizationModel: 'rbac-v1',
    };
  }

  @Get('users')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.read')
  @ApiOperation({
    summary: 'Search and list users for administrative investigation',
    description:
      'Returns the existing bounded admin user-list contract through the versioned admin API. Requires the users.read capability.',
  })
  @ApiOkResponse({ description: 'Paginated administrative user results' })
  listUsers(@Query() query: AdminUserQueryDto): Promise<AdminUserListResult> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id/login-history')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.sessions.read')
  @ApiOperation({
    summary: 'Inspect bounded privacy-scrubbed login history for one user',
    description:
      'Returns at most 50 recent login-history entries using the existing privacy-scrubbed backend service. This endpoint is intentionally separated from users.read because IP and user-agent derived data are more sensitive investigation metadata.',
  })
  @ApiParam({ name: 'id', description: 'Target user identifier' })
  @ApiOkResponse({ description: 'Privacy-scrubbed login history returned' })
  getUserLoginHistory(
    @Param('id') id: string,
  ): Promise<LoginHistoryEntry[]> {
    return this.adminService.getLoginHistory(id);
  }

  @Get('users/:id')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.read')
  @ApiOperation({
    summary: 'Inspect bounded administrative metadata for one user',
    description:
      'Returns the same minimized operational user fields exposed by search. It does not expose credentials, email, session tokens or unrestricted private profile data.',
  })
  @ApiParam({ name: 'id', description: 'Target user identifier' })
  @ApiOkResponse({ description: 'Administrative user summary returned' })
  @ApiNotFoundResponse({ description: 'User not found' })
  getUser(@Param('id') id: string): Promise<AdminUserSummary> {
    return this.userDetailService.getUser(id);
  }
}
