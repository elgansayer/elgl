import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CrashReportService } from './crash-report.service';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
import { EscrowCacheInterceptor, ESCROW_CACHE_PRIVATE_SHORT, ESCROW_CACHE_PRIVATE_NO_STORE } from './cache.interceptor';
import { CacheControlInterceptor, CACHE_EDGE_SHORT, CACHE_NO_STORE } from '../common/cache.interceptor';
import {
  AcknowledgeCrashReportDto,
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowTransactionResponse,
  CircuitBreakerStatusResponse,
} from './dto/escrow.dto';

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
@UseFilters(EscrowExceptionFilter)
@ApiBearerAuth()
@ApiTags('Escrow Payments')
export class EscrowController {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly crashReportService: CrashReportService,
  ) {}

  /**
   * POST /escrow/create
   * Create a new escrow transaction, holding coins from the payer.
   * Rate limited to 5 requests per minute.
   * Caching: no-store. This is a mutation.
   */
  @Post('create')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Create a new escrow transaction',
    description:
      'Locks coins from the payer and holds them in escrow until released to the payee or refunded. ' +
      'The payer must have sufficient coin balance. Self-escrow (payer === payee) is rejected. ' +
      'Rate limited to 5 requests per minute.',
  })
  @ApiCreatedResponse({
    description: 'Escrow transaction created successfully.',
    schema: {
      properties: {
        id: { type: 'string', description: 'UUID of the created escrow transaction' },
        status: { type: 'string', enum: ['held'], description: 'Escrow status (always "held" on creation)' },
        amount_coins: { type: 'number', description: 'Number of coins held in escrow' },
        payer_balance: { type: 'number', description: 'Remaining coin balance of the payer after deduction' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request body or self-escrow attempt.' })
  @ApiNotFoundResponse({ description: 'Payee user not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async create(
    @Req() req: { user?: { id?: string } },
    @Body() dto: CreateEscrowDto,
  ) {
    return this.escrowService.holdCoins(req.user!.id!, dto);
  }

  @Post('release')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Release escrowed coins to the payee',
    description:
      'Transfers the held coins to the payee. Only the original payer can release the escrow. ' +
      'The escrow must be in "held" status. Rate limited to 5 requests per minute.',
  })
  @ApiOkResponse({
    description: 'Escrow released successfully.',
    schema: {
      properties: {
        id: { type: 'string', description: 'UUID of the escrow transaction' },
        status: { type: 'string', enum: ['released'], description: 'Escrow status' },
        amount_coins: { type: 'number', description: 'Number of coins released' },
        payee_balance: { type: 'number', description: 'Updated coin balance of the payee' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found.' })
  @ApiForbiddenResponse({ description: 'Caller is not the payer of this escrow.' })
  @ApiConflictResponse({ description: 'Escrow is not in "held" status.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async release(
    @Req() req: { user?: { id?: string } },
    @Body() dto: ReleaseEscrowDto,
  ) {
    return this.escrowService.releaseCoins(dto.transaction_id, req.user!.id!);
  }

  @Post('refund')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Refund escrowed coins back to the payer',
    description:
      'Returns the held coins to the original payer. Only the payer can initiate a refund. ' +
      'The escrow must be in "held" status. Rate limited to 5 requests per minute.',
  })
  @ApiOkResponse({
    description: 'Escrow refunded successfully.',
    schema: {
      properties: {
        id: { type: 'string', description: 'UUID of the escrow transaction' },
        status: { type: 'string', enum: ['refunded'], description: 'Escrow status' },
        amount_coins: { type: 'number', description: 'Number of coins refunded' },
        payer_balance: { type: 'number', description: 'Updated coin balance of the payer after refund' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found.' })
  @ApiForbiddenResponse({ description: 'Caller is not the payer of this escrow.' })
  @ApiConflictResponse({ description: 'Escrow is not in "held" status.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async refund(
    @Req() req: { user?: { id?: string } },
    @Body() dto: RefundEscrowDto,
  ) {
    return this.escrowService.refundCoins(
      dto.transaction_id,
      req.user!.id!,
      dto.reason,
    );
  }

  /**
   * GET /escrow/list
   * List escrow transactions for the authenticated user.
   * Rate limited to 20 requests per minute.
   *
   * Caching: private short-lived. Each user sees their own escrows and
   * statuses can change rapidly, but a short cache reduces DB pressure
   * during repeated reads by the frontend polling loop.
   */
  @Get('list')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT))
  @ApiOperation({
    summary: 'List escrow transactions for the authenticated user',
    description:
      'Returns paginated escrow transactions where the user is either the payer or payee. ' +
      'Results are ordered by creation date descending. Maximum 50 items per page. ' +
      'Rate limited to 20 requests per minute.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of escrows to return (1-50, default 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of escrows to skip for pagination (default 0)',
    example: 0,
  })
  @ApiOkResponse({
    description: 'Paginated list of escrow transactions.',
    schema: {
      properties: {
        escrows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'UUID of the escrow transaction' },
              payer_id: { type: 'string', description: 'UUID of the payer' },
              payee_id: { type: 'string', description: 'UUID of the payee' },
              amount_coins: { type: 'number', description: 'Number of coins held' },
              status: { type: 'string', enum: ['held', 'released', 'refunded', 'disputed'], description: 'Current escrow status' },
              description: { type: 'string', nullable: true, description: 'Optional description' },
              reference_id: { type: 'string', nullable: true, description: 'Optional client reference ID' },
              created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
              updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
              released_at: { type: 'string', format: 'date-time', nullable: true, description: 'Release timestamp (if released)' },
              refunded_at: { type: 'string', format: 'date-time', nullable: true, description: 'Refund timestamp (if refunded)' },
            },
          },
        },
        total: { type: 'number', description: 'Total count of matching escrow transactions' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async list(
    @Req() req: { user?: { id?: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<EscrowTransactionResponse[]> {
    return this.escrowService.listTransactions(
      req.user!.id!,
      undefined,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * GET /escrow/:id
   * Get a single escrow transaction by ID.
   * Rate limited to 30 requests per minute.
   *
   * Caching: private short-lived. User-specific escrow details benefit
   * from short-term Cloudflare edge caching while keeping freshness.
   */
  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT))
  @ApiOperation({
    summary: 'Get a single escrow transaction by ID',
    description:
      'Returns the full escrow transaction details. The caller must be either the payer or the payee. ' +
      'Rate limited to 30 requests per minute.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'UUID of the escrow transaction',
    example: 'b7e4f1a2-c3d5-4e6f-8901-abcdef012345',
  })
  @ApiOkResponse({
    description: 'Escrow transaction details.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID of the escrow transaction' },
        payer_id: { type: 'string', description: 'UUID of the payer' },
        payee_id: { type: 'string', description: 'UUID of the payee' },
        amount_coins: { type: 'number', description: 'Number of coins held' },
        status: { type: 'string', enum: ['held', 'released', 'refunded', 'disputed'], description: 'Current escrow status' },
        description: { type: 'string', nullable: true, description: 'Optional description' },
        reference_id: { type: 'string', nullable: true, description: 'Optional client reference ID' },
        created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
        released_at: { type: 'string', format: 'date-time', nullable: true, description: 'Release timestamp (if released)' },
        refunded_at: { type: 'string', format: 'date-time', nullable: true, description: 'Refund timestamp (if refunded)' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found.' })
  @ApiForbiddenResponse({ description: 'Caller is not a participant in this escrow.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async getById(
    @Req() req: { user?: { id?: string } },
    @Param('id') id: string,
  ): Promise<EscrowTransactionResponse> {
    return this.escrowService.getTransaction(id, req.user!.id!);
  }

  @Get('circuit-breaker/status')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_SHORT))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get circuit breaker status for escrow service',
    description:
      'Returns the current state of the escrow service circuit breaker, including failure counts, cooldown status, and aggregate success/failure statistics. Useful for monitoring and debugging the escrow service health.',
  })
  @ApiOkResponse({
    description: 'Circuit breaker status',
    schema: {
      properties: {
        service: { type: 'string', example: 'escrow', description: 'Service name' },
        isOpen: { type: 'boolean', description: 'Whether the circuit breaker is currently open (failing)' },
        failureCount: { type: 'number', description: 'Current consecutive failure count' },
        cooldownUntil: { type: 'number', description: 'Timestamp (ms) until circuit breaker cooldown ends' },
        totalFailures: { type: 'number', description: 'Total failures since last reset' },
        totalSuccesses: { type: 'number', description: 'Total successes since last reset' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getCircuitBreakerStatus(): CircuitBreakerStatusResponse {
    return this.escrowService.getCircuitBreakerStatus();
  }

  @Post('circuit-breaker/reset')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Reset circuit breaker for escrow service (admin)',
    description:
      'Manually resets the escrow service circuit breaker, clearing all failure counts and closing the circuit. This endpoint should only be used by administrators after confirming the underlying issue has been resolved.',
  })
  @ApiOkResponse({
    description: 'Circuit breaker reset successfully',
    schema: {
      properties: {
        reset: { type: 'boolean', example: true, description: 'Confirms the circuit breaker was reset' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  resetCircuitBreaker(): { reset: boolean } {
    this.escrowService.resetCircuitBreaker();
    return { reset: true };
  }

  @Get('crash-reports')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_SHORT))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List unresolved crash reports for escrow service (admin)',
    description:
      'Returns all unresolved crash reports for the escrow service, ordered by most recent first. Used for admin triage of escrow service errors.',
  })
  @ApiOkResponse({ description: 'List of crash reports' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async listCrashReports() {
    return this.crashReportService.listUnresolved();
  }

  @Post('crash-reports/acknowledge')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Acknowledge a crash report (admin)',
    description:
      'Marks a crash report as acknowledged by an administrator after reviewing it.',
  })
  @ApiBody({ type: AcknowledgeCrashReportDto })
  @ApiOkResponse({
    description: 'Crash report acknowledged',
    schema: {
      properties: {
        acknowledged: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async acknowledgeCrashReport(
    @Body() dto: AcknowledgeCrashReportDto,
  ): Promise<{ acknowledged: boolean }> {
    const result = await this.crashReportService.acknowledgeReport(dto.report_id);
    return { acknowledged: result };
  }

  @Post('crash-reports/resolve')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Resolve a crash report (admin)',
    description:
      'Marks a crash report as resolved by an administrator after the underlying issue has been fixed.',
  })
  @ApiBody({ type: AcknowledgeCrashReportDto })
  @ApiOkResponse({
    description: 'Crash report resolved',
    schema: {
      properties: {
        resolved: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async resolveCrashReport(
    @Body() dto: AcknowledgeCrashReportDto,
  ): Promise<{ resolved: boolean }> {
    const result = await this.crashReportService.resolveReport(dto.report_id);
    return { resolved: result };
  }
}
