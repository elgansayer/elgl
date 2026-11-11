import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  DmcaService,
  DmcaSubmissionResult,
  DmcaVerificationResult,
  OwnerNoticeView,
} from './dmca.service';
import { CreateCounterNoticeDto } from './dto/create-counter-notice.dto';
import { CreateDmcaNoticeDto } from './dto/create-dmca-notice.dto';
import { OwnerNoticesQueryDto } from './dto/owner-notices-query.dto';
import { VerifyDmcaNoticeDto } from './dto/verify-dmca-notice.dto';

const NO_STORE = 'no-store';

@ApiTags('DMCA')
@Controller('dmca')
export class DmcaController {
  constructor(private readonly dmcaService: DmcaService) {}

  /**
   * Public: copyright owners are not users of the service. Abuse is bounded by
   * the per-address throttle, a per-mailbox daily cap, and the fact that
   * nothing is disabled until the mailbox is confirmed.
   */
  @Post('notices')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Submit a copyright takedown notice',
    description:
      'Creates one pending notice per identified item and emails a single confirmation link. Nothing is removed until the link is used.',
  })
  @ApiAcceptedResponse({
    description: 'Notice recorded; confirmation email sent',
  })
  @ApiBadRequestResponse({
    description: 'A required statutory element is missing or invalid',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit or daily mailbox cap exceeded',
  })
  async submit(
    @Body() dto: CreateDmcaNoticeDto,
  ): Promise<DmcaSubmissionResult> {
    return this.dmcaService.submitNotice(dto);
  }

  @Post('notices/verify')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Confirm the claimant mailbox and start processing',
    description:
      'Safe to repeat: a used token reports the current state of each item.',
  })
  @ApiOkResponse({
    description: 'Current state of every item in the submission',
  })
  @ApiNotFoundResponse({ description: 'Unknown token' })
  @ApiGoneResponse({ description: 'The confirmation window has passed' })
  async verify(
    @Body() dto: VerifyDmcaNoticeDto,
  ): Promise<DmcaVerificationResult> {
    return this.dmcaService.verifyNotice(dto.token);
  }

  @Get('notices/mine')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('bearer')
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'List copyright notices about the caller content' })
  @ApiOkResponse({ description: 'Notices, newest first' })
  async listMine(
    @CurrentUser() user: User | null,
    @Query() query: OwnerNoticesQueryDto,
  ): Promise<OwnerNoticeView[]> {
    if (!user) throw new UnauthorizedException();
    return this.dmcaService.listOwnerNotices(
      user.id,
      query.page,
      query.pageSize,
    );
  }

  @Post('notices/:id/counter-notice')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'File a counter-notification for disabled content',
    description:
      'Only the content owner may file. Repeating the request returns the existing counter-notification.',
  })
  @ApiOkResponse({ description: 'The updated notice' })
  @ApiNotFoundResponse({ description: 'Not a notice about the caller content' })
  @ApiConflictResponse({
    description:
      'The notice is not in a state that accepts a counter-notification',
  })
  async counterNotice(
    @CurrentUser() user: User | null,
    @Param('id', new ParseUUIDPipe()) noticeId: string,
    @Body() dto: CreateCounterNoticeDto,
  ): Promise<OwnerNoticeView> {
    if (!user) throw new UnauthorizedException();
    return this.dmcaService.submitCounterNotice(user.id, noticeId, dto);
  }
}
