import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminService } from './admin.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminUserListResult } from './interfaces/admin-user.interface';

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
}
