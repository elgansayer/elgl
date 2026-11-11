import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AgeGateExempt } from './age-gate-exempt.decorator';
import { AgeGateService, AgeGateStatusView } from './age-gate.service';
import { SubmitAgeGateDto } from './dto/submit-age-gate.dto';

const NO_STORE = 'no-store';

/**
 * The age gate must be reachable by exactly the accounts it blocks everywhere
 * else, so the whole controller is exempt from the age-assurance check.
 */
@ApiTags('Age gate')
@ApiBearerAuth('bearer')
@Controller('age-gate')
@UseGuards(SupabaseAuthGuard)
@AgeGateExempt()
export class AgeGateController {
  constructor(private readonly ageGateService: AgeGateService) {}

  @Get('status')
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Read the caller age-gate state',
    description:
      'Returns whether the account must declare a date of birth or has been blocked. The minimum age and any stored date are never returned.',
  })
  @ApiOkResponse({ description: 'Current age-gate state' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async getStatus(
    @CurrentUser() user: User | null,
  ): Promise<AgeGateStatusView> {
    if (!user) throw new UnauthorizedException();
    return this.ageGateService.getStatus(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Declare a date of birth',
    description:
      'The first declaration wins. A declaration under the minimum age blocks the account and schedules its erasure; the date is not stored. The response is identical in shape for every outcome so a client cannot probe the threshold.',
  })
  @ApiOkResponse({ description: 'Resulting age-gate state' })
  @ApiBadRequestResponse({ description: 'INVALID_DATE_OF_BIRTH' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Not applicable: the gate is exempt' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async submit(
    @CurrentUser() user: User | null,
    @Body() dto: SubmitAgeGateDto,
  ): Promise<AgeGateStatusView> {
    if (!user) throw new UnauthorizedException();
    return this.ageGateService.submitDateOfBirth(
      { id: user.id, email: user.email ?? null },
      dto,
    );
  }
}
