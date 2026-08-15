import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AdminOperationalEventsService,
  AdminOperationalEventsResult,
} from './admin-operational-events.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminOperationalEventsQueryDto } from './dto/admin-operational-events-query.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

@ApiTags('Admin v1')
@ApiBearerAuth('bearer')
@Controller('admin/v1/logs')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
@RequireAdminCapabilities('logs.read')
export class AdminOperationalEventsV1Controller {
  constructor(private readonly events: AdminOperationalEventsService) {}

  @Get()
  @ApiOperation({
    summary: 'List sanitized operational events',
    description:
      'Returns bounded structured operational events only. Raw process logs, stack traces, request bodies, credentials and arbitrary metadata are not exposed.',
  })
  @ApiOkResponse({ description: 'Paginated sanitized operational events' })
  list(
    @Query() query: AdminOperationalEventsQueryDto,
  ): Promise<AdminOperationalEventsResult> {
    return this.events.list(query);
  }
}
