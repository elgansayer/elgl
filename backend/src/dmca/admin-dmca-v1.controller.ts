import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RequireAdminCapabilities } from '../admin/decorators/require-admin-capabilities.decorator';
import { AdminCapabilityGuard } from '../admin/guards/admin-capability.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  DmcaOperatorService,
  OperatorNoticeDetail,
  OperatorNoticeList,
} from './dmca-operator.service';
import {
  AdminDmcaDecisionDto,
  AdminDmcaListQueryDto,
} from './dto/admin-dmca.dto';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string };
}

/**
 * Operator tooling. Every request under /admin is audited by the global
 * AdminMutationAuditInterceptor (actor, route, capability, reason code and
 * operator note), so decisions need no bespoke audit code here.
 */
@ApiTags('Admin v1 - DMCA')
@ApiBearerAuth('bearer')
@Controller('admin/v1/dmca/notices')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
export class AdminDmcaV1Controller {
  constructor(private readonly operatorService: DmcaOperatorService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequireAdminCapabilities('moderation.cases.read')
  @ApiOperation({
    summary: 'List DMCA notices, newest first, with optional status filter',
  })
  @ApiOkResponse({ description: 'A bounded page of notice summaries' })
  async list(
    @Query() query: AdminDmcaListQueryDto,
  ): Promise<OperatorNoticeList> {
    return this.operatorService.list(query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequireAdminCapabilities('moderation.cases.read')
  @ApiOperation({
    summary:
      'Read one notice with its event trail and any counter-notification',
  })
  @ApiOkResponse({ description: 'Notice detail' })
  @ApiNotFoundResponse({ description: 'Unknown notice' })
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OperatorNoticeDetail> {
    return this.operatorService.get(id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequireAdminCapabilities('moderation.cases.manage')
  @ApiOperation({
    summary: 'Disable, reject, mark withdrawn or hold a notice',
    description:
      'Reject and withdraw restore the material immediately. Disable applies to notices the system could not locate. Hold stops automatic restoration while a court action is pending.',
  })
  @ApiOkResponse({ description: 'The updated notice' })
  @ApiNotFoundResponse({ description: 'Unknown notice or material' })
  @ApiConflictResponse({
    description: 'The notice is not in a state that allows this decision',
  })
  async decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminDmcaDecisionDto,
    @Req() req: AdminAuthRequest,
  ): Promise<OperatorNoticeDetail> {
    const operatorId = req.user.id ?? req.user.sub;
    if (!operatorId) throw new UnauthorizedException();
    return this.operatorService.decide(id, operatorId, dto);
  }
}
