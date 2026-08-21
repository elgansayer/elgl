import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminAuditService } from './admin-audit.service';
import {
  AdminOperationalEventsService,
  AdminOperationalEventsResult,
} from './admin-operational-events.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminOperationalEventsQueryDto } from './dto/admin-operational-events-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string; email?: string };
}

@ApiTags('Admin v1')
@ApiBearerAuth('bearer')
@Controller('admin/v1/logs')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
@RequireAdminCapabilities('logs.read')
export class AdminOperationalEventsV1Controller {
  constructor(
    private readonly events: AdminOperationalEventsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List sanitized operational events',
    description:
      'Returns bounded structured operational events only. Raw process logs, stack traces, request bodies, credentials and arbitrary metadata are not exposed.',
  })
  @ApiOkResponse({ description: 'Paginated sanitized operational events' })
  async list(
    @Query() query: AdminOperationalEventsQueryDto,
    @Req() req: AdminAuthRequest,
  ): Promise<AdminOperationalEventsResult> {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const requestId = req.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;

    let result: AdminOperationalEventsResult;
    try {
      result = await this.events.list(query);
    } catch (error) {
      await this.audit.record({
        actorUserId,
        action: 'operational.events.read',
        capabilityKey: 'logs.read',
        targetType: 'operational-event-log',
        outcome: 'failed',
        correlationId,
        metadata: { source: 'admin-operational-events-v1' },
      });
      throw error;
    }

    await this.audit.record({
      actorUserId,
      action: 'operational.events.read',
      capabilityKey: 'logs.read',
      targetType: 'operational-event-log',
      outcome: 'success',
      correlationId,
      metadata: {
        resultCount: result.events.length,
        total: result.total,
        source: 'admin-operational-events-v1',
      },
    });

    return result;
  }
}
