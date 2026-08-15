import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminAuthorizationService } from './admin-authorization.service';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string; email?: string };
}

@ApiTags('Admin v1')
@ApiBearerAuth('bearer')
@Controller('admin/v1')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminV1Controller {
  constructor(private readonly authorization: AdminAuthorizationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated admin context and effective capabilities' })
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
}
