import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import {
  AdminAuditListResult,
  AdminAuditQueryService,
} from './admin-audit-query.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminLoginHistoryQueryService } from './admin-login-history-query.service';
import { AdminModerationQueryService } from './admin-moderation-query.service';
import {
  AdminRoleInventoryEntry,
  AdminRoleInventoryService,
} from './admin-role-inventory.service';
import { AdminService } from './admin.service';
import {
  AdminSystemHealthService,
  AdminSystemHealthSnapshot,
} from './admin-system-health.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';
import {
  AdminReportsListResult,
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
    private readonly loginHistoryQuery: AdminLoginHistoryQueryService,
    private readonly audit: AdminAuditService,
    private readonly auditQuery: AdminAuditQueryService,
    private readonly moderationQuery: AdminModerationQueryService,
    private readonly systemHealth: AdminSystemHealthService,
    private readonly roleInventory: AdminRoleInventoryService,
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

  @Get('roles')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('roles.read')
  @ApiOperation({
    summary: 'List administrative roles and capability assignments',
    description:
      'Returns a read-only inventory of role definitions and registered capability keys. It does not expose role-assignment mutations or private user data.',
  })
  @ApiOkResponse({ description: 'Administrative role inventory' })
  listRoles(): Promise<AdminRoleInventoryEntry[]> {
    return this.roleInventory.list();
  }

  @Get('system/health')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('system.health.read')
  @ApiOperation({
    summary: 'Read a bounded administrative dependency-health snapshot',
    description:
      'Reports only healthy/degraded state for core database and Redis dependencies. It intentionally excludes hosts, credentials, connection strings and raw exception details.',
  })
  @ApiOkResponse({ description: 'Bounded system health snapshot' })
  async getSystemHealth(
    @Req() req: AdminAuthRequest,
  ): Promise<AdminSystemHealthSnapshot> {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const requestId = req.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;

    let result: AdminSystemHealthSnapshot;
    try {
      result = await this.systemHealth.getSnapshot();
    } catch (error) {
      await this.audit.record({
        actorUserId,
        action: 'system.health.read',
        capabilityKey: 'system.health.read',
        targetType: 'system-health',
        outcome: 'failed',
        correlationId,
        metadata: { source: 'admin-v1' },
      });
      throw error;
    }

    await this.audit.record({
      actorUserId,
      action: 'system.health.read',
      capabilityKey: 'system.health.read',
      targetType: 'system-health',
      outcome: 'success',
      correlationId,
      metadata: { source: 'admin-v1' },
    });

    return result;
  }

  @Get('audit')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('audit.read')
  @ApiOperation({
    summary: 'List bounded administrative audit events',
    description:
      'Returns newest-first sanitized audit summaries with exact-match filters. Private operator notes are intentionally excluded from this initial read contract.',
  })
  @ApiOkResponse({ description: 'Paginated administrative audit events' })
  async listAudit(
    @Query() query: AdminAuditQueryDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminAuditListResult> {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const requestId = req.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;

    let result: AdminAuditListResult;
    try {
      result = await this.auditQuery.list(query);
    } catch (error) {
      await this.audit.record({
        actorUserId,
        action: 'audit.events.read',
        capabilityKey: 'audit.read',
        targetType: 'admin-audit-log',
        outcome: 'failed',
        correlationId,
        metadata: { source: 'admin-v1' },
      });
      throw error;
    }

    await this.audit.record({
      actorUserId,
      action: 'audit.events.read',
      capabilityKey: 'audit.read',
      targetType: 'admin-audit-log',
      outcome: 'success',
      correlationId,
      metadata: {
        resultCount: result.events.length,
        total: result.total,
        source: 'admin-v1',
      },
    });

    return result;
  }

  @Get('moderation/reports')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.read')
  @ApiOperation({
    summary: 'List bounded moderation reports for triage',
    description:
      'Returns newest-first report summaries through the dedicated admin API. This read-only queue requires moderation.cases.read and supports exact status and reason-category filters.',
  })
  @ApiOkResponse({ description: 'Paginated moderation reports' })
  async listModerationReports(
    @Query() query: AdminReportsQueryDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminReportsListResult> {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const requestId = req.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;

    let result: AdminReportsListResult;
    try {
      result = await this.moderationQuery.list(query);
    } catch (error) {
      await this.audit.record({
        actorUserId,
        action: 'moderation.reports.read',
        capabilityKey: 'moderation.cases.read',
        targetType: 'moderation-report-queue',
        outcome: 'failed',
        correlationId,
        metadata: { source: 'admin-v1' },
      });
      throw error;
    }

    await this.audit.record({
      actorUserId,
      action: 'moderation.reports.read',
      capabilityKey: 'moderation.cases.read',
      targetType: 'moderation-report-queue',
      outcome: 'success',
      correlationId,
      metadata: {
        resultCount: result.reports.length,
        total: result.total,
        source: 'admin-v1',
      },
    });

    return result;
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
      'Returns at most 50 recent login-history entries using a strict privacy-scrubbed query. This endpoint is intentionally separated from users.read because IP and user-agent derived data are more sensitive investigation metadata.',
  })
  @ApiParam({ name: 'id', description: 'Target user identifier' })
  @ApiOkResponse({ description: 'Privacy-scrubbed login history returned' })
  async getUserLoginHistory(
    @Param('id') id: string,
    @Req() req: AdminAuthRequest,
  ): Promise<LoginHistoryEntry[]> {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const requestId = req.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;

    let result: LoginHistoryEntry[];
    try {
      result = await this.loginHistoryQuery.list(id);
    } catch (error) {
      await this.audit.record({
        actorUserId,
        action: 'users.login_history.read',
        capabilityKey: 'users.sessions.read',
        targetType: 'user',
        targetId: id,
        outcome: 'failed',
        correlationId,
        metadata: { source: 'admin-v1' },
      });
      throw error;
    }

    await this.audit.record({
      actorUserId,
      action: 'users.login_history.read',
      capabilityKey: 'users.sessions.read',
      targetType: 'user',
      targetId: id,
      outcome: 'success',
      correlationId,
      metadata: { resultCount: result.length, source: 'admin-v1' },
    });

    return result;
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
