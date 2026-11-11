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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  AccountSuspensionService,
  SuspensionOutcome,
} from '../account-suspension/account-suspension.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CACHE_NO_STORE,
  CACHE_PRIVATE_NO_STORE,
  CacheControlInterceptor,
} from '../common/cache.interceptor';
import {
  AdminFlaggedMomentsListResult,
  AdminFlaggedMomentsService,
  ResolveFlaggedMomentResult,
} from './admin-flagged-moments.service';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import {
  AdminFlaggedMomentsQueryDto,
  IssueAccountSuspensionDto,
  LiftAccountSuspensionDto,
  ResolveFlaggedMomentDto,
} from './dto/admin-moderation-actions.dto';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

interface AdminAuthRequest extends Request {
  user: { id?: string; sub?: string };
}

/**
 * Moderation queue for flagged Moments and the enforcement that follows from
 * review. Every request is audited by `AdminMutationAuditInterceptor` with the
 * actor, target, reason code, outcome and correlation id; private operator notes
 * are stored there and are never returned by these endpoints.
 */
@ApiTags('Admin v1 - Moderation')
@ApiBearerAuth('bearer')
@Controller('admin/v1/moderation')
@UseGuards(SupabaseAuthGuard, AdminGuard, AdminCapabilityGuard)
export class AdminModerationV1Controller {
  constructor(
    private readonly flaggedMoments: AdminFlaggedMomentsService,
    private readonly suspensions: AccountSuspensionService,
  ) {}

  @Get('flagged-moments')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @RequireAdminCapabilities('moderation.cases.read')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'List Moments that members have flagged for review',
    description:
      'Newest-first and bounded to 50 per page. Each item carries the text captured at flag time, the author, the reporter and the author’s active suspension, if any.',
  })
  @ApiOkResponse({ description: 'Paginated flagged Moments' })
  list(
    @Query() query: AdminFlaggedMomentsQueryDto,
  ): Promise<AdminFlaggedMomentsListResult> {
    return this.flaggedMoments.list(query);
  }

  @Post('flagged-moments/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Dismiss or uphold one flagged-Moment report',
    description:
      'dismiss marks the report approved (no violation); uphold marks it rejected (violation confirmed). Repeating the same decision is a no-op.',
  })
  @ApiConflictResponse({
    description: 'The report was already resolved with the opposite decision',
  })
  resolve(
    @Param('id', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ResolveFlaggedMomentDto,
  ): Promise<ResolveFlaggedMomentResult> {
    return this.flaggedMoments.resolve(reportId, dto.decision);
  }

  @Post('users/:id/suspensions')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Suspend an account for a bounded period',
    description:
      'Blocks the account at the authentication boundary until expiresAt (at most 90 days). Reversible through the lift endpoint. Idempotent per idempotencyKey. Administrators and the caller cannot be suspended.',
  })
  @ApiForbiddenResponse({ description: 'The target holds admin capabilities' })
  @ApiConflictResponse({
    description: 'The idempotency key was already used for a different user',
  })
  async suspend(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: IssueAccountSuspensionDto,
    @Req() req: AdminAuthRequest,
  ) {
    return this.flaggedMoments.suspendUser(this.actor(req), userId, dto);
  }

  @Post('suspensions/:id/lift')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Lift an account suspension before it expires',
    description:
      'The account regains access within the authentication cache window (30 seconds). Lifting an already lifted suspension is a no-op.',
  })
  lift(
    @Param('id', new ParseUUIDPipe()) suspensionId: string,
    @Body() dto: LiftAccountSuspensionDto,
    @Req() req: AdminAuthRequest,
  ): Promise<SuspensionOutcome> {
    return this.suspensions.lift({
      actorUserId: this.actor(req),
      suspensionId,
      reasonCode: dto.reasonCode,
      operatorNote: dto.operatorNote,
    });
  }

  private actor(req: AdminAuthRequest): string {
    const actorUserId = req.user.id ?? req.user.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }
    return actorUserId;
  }
}
