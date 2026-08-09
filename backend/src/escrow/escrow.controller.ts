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
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CrashReportService } from './crash-report.service';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { EscrowService } from './escrow.service';
import {
  AcknowledgeCrashReportDto,
  CreateEscrowHoldDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  CancelEscrowDto,
  DisputeEscrowDto,
  EscrowTransactionResponse,
  CircuitBreakerStatusResponse,
} from './dto/escrow.dto';
import { EscrowStatus } from './interfaces/escrow-transaction.interface';
import {
  CacheControlInterceptor,
  CACHE_EDGE_SHORT,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
  CACHE_TAG_ESCROW,
} from '../common/cache.interceptor';

interface AuthenticatedRequest {
  user: { sub: string };
}

@ApiTags('Escrow Payments')
@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
@UseFilters(EscrowExceptionFilter)
@ApiBearerAuth()
export class EscrowController {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly crashReportService: CrashReportService,
  ) {}

  @Post('hold')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Hold coins in escrow for a transaction',
    description:
      'Creates an escrow hold by deducting the specified coin amount from the authenticated user (payer) and holding it in escrow. The coins are only transferred to the payee upon explicit release. The payee must be a valid user different from the payer.',
  })
  @ApiBody({ type: CreateEscrowHoldDto })
  @ApiCreatedResponse({
    description: 'Escrow hold created successfully',
    schema: {
      properties: {
        id: {
          type: 'string',
          description: 'Unique escrow transaction ID (UUID)',
        },
        status: {
          type: 'string',
          enum: ['held'],
          description: 'Transaction status',
        },
        amount_held: {
          type: 'number',
          description: 'Amount of coins held in escrow',
        },
        coins_remaining: {
          type: 'number',
          description: 'Payer coin balance after escrow deduction',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid payload, payee same as payer, or insufficient coin balance',
  })
  @ApiNotFoundResponse({ description: 'Payee user not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to deduct coins or create escrow record',
  })
  async holdCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEscrowHoldDto,
  ) {
    return this.escrowService.holdCoins(req.user.sub, dto);
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Release held escrow coins to the payee',
    description:
      'Releases the held coins from an escrow transaction to the payee. Only the original payer can release the escrow. The escrow must be in "held" status. The coins are credited to the payee account.',
  })
  @ApiBody({ type: ReleaseEscrowDto })
  @ApiOkResponse({
    description: 'Escrow released successfully to payee',
    schema: {
      properties: {
        id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
        status: {
          type: 'string',
          enum: ['released'],
          description: 'Updated transaction status',
        },
        amount_released: {
          type: 'number',
          description: 'Amount of coins released to payee',
        },
        payee_new_balance: {
          type: 'number',
          description: 'Payee coin balance after credit',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Escrow is not in held status' })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found' })
  @ApiForbiddenResponse({
    description: 'Only the payer can release the escrow',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to credit payee or update escrow status',
  })
  async releaseCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReleaseEscrowDto,
  ) {
    return this.escrowService.releaseCoins(dto.transaction_id, req.user.sub);
  }

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Refund escrow coins back to the payer',
    description:
      'Refunds the held coins from an escrow transaction back to the original payer. Only the original payer can request a refund. The escrow must be in "held" status. An optional reason can be provided.',
  })
  @ApiBody({ type: RefundEscrowDto })
  @ApiOkResponse({
    description: 'Escrow refunded successfully to payer',
    schema: {
      properties: {
        id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
        status: {
          type: 'string',
          enum: ['refunded'],
          description: 'Updated transaction status',
        },
        amount_refunded: {
          type: 'number',
          description: 'Amount of coins refunded to payer',
        },
        payer_new_balance: {
          type: 'number',
          description: 'Payer coin balance after refund',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Escrow is not in held status' })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found' })
  @ApiForbiddenResponse({ description: 'Only the payer can request a refund' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to refund payer or update escrow status',
  })
  async refundCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RefundEscrowDto,
  ) {
    return this.escrowService.refundCoins(
      dto.transaction_id,
      req.user.sub,
      dto.reason,
    );
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Cancel an escrow transaction',
    description:
      'Cancels a pending escrow transaction. The coins are refunded back to the payer. Only the payer can cancel the escrow. The escrow must be in "held" status.',
  })
  @ApiBody({ type: CancelEscrowDto })
  @ApiOkResponse({
    description: 'Escrow cancelled successfully',
    schema: {
      properties: {
        id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
        status: {
          type: 'string',
          enum: ['cancelled'],
          description: 'Updated transaction status',
        },
        amount_refunded: {
          type: 'number',
          description: 'Amount of coins refunded to payer',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Escrow is not in held status' })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found' })
  @ApiForbiddenResponse({ description: 'Only the payer can cancel the escrow' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async cancelEscrow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CancelEscrowDto,
  ) {
    return this.escrowService.cancelEscrow(dto.transaction_id, req.user.sub);
  }

  @Post('dispute')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'File a dispute against an escrow transaction',
    description:
      'Files a dispute against a held escrow transaction. Either the payer or payee can initiate the dispute. The escrow must be in "held" status. The transaction status is updated to "disputed" and the dispute reason is recorded.',
  })
  @ApiBody({ type: DisputeEscrowDto })
  @ApiOkResponse({
    description: 'Dispute filed successfully',
    schema: {
      properties: {
        id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
        status: {
          type: 'string',
          enum: ['disputed'],
          description: 'Updated transaction status',
        },
        reason: {
          type: 'string',
          description: 'Updated reason including dispute details',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid payload or user not a participant',
  })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async disputeEscrow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DisputeEscrowDto,
  ) {
    return this.escrowService.disputeEscrow(
      dto.transaction_id,
      req.user.sub,
      dto.reason,
      dto.evidence,
    );
  }

  @Get('transactions')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [CACHE_TAG_ESCROW]),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List escrow transactions for the current user',
    description:
      'Returns all escrow transactions where the authenticated user is either the payer or the payee. Results are paginated and ordered by creation date descending. Optionally filter by status.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by escrow transaction status',
    enum: ['held', 'released', 'refunded', 'cancelled'],
    example: 'held',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of transactions to return (default 20)',
    example: '20',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of transactions to skip for pagination (default 0)',
    example: '0',
  })
  @ApiOkResponse({
    description: 'Paginated list of escrow transactions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
          payer_id: { type: 'string', description: 'Payer user UUID' },
          payee_id: { type: 'string', description: 'Payee user UUID' },
          amount_coins: {
            type: 'number',
            description: 'Coin amount held in escrow',
          },
          status: {
            type: 'string',
            enum: ['held', 'released', 'refunded', 'cancelled'],
            description: 'Transaction status',
          },
          reason: { type: 'string', description: 'Reason for the escrow hold' },
          metadata: {
            type: 'object',
            description: 'Additional transaction metadata',
          },
          held_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when escrow was held',
          },
          released_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when escrow was released',
          },
          refunded_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when escrow was refunded',
          },
          cancelled_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when escrow was cancelled',
          },
          retry_count: {
            type: 'number',
            description: 'Number of retry attempts',
          },
          last_error: {
            type: 'string',
            nullable: true,
            description: 'Last error message if any',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          degraded: {
            type: 'boolean',
            description:
              'Whether the transaction is operating in degraded mode',
          },
          fallback_reason: {
            type: 'string',
            description: 'Reason for fallback mode if applicable',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid status filter value' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async listTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: EscrowStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<EscrowTransactionResponse[]> {
    return this.escrowService.listTransactions(
      req.user.sub,
      status,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('transactions/:id')
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [CACHE_TAG_ESCROW]),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get an escrow transaction by ID',
    description:
      'Retrieves full details of a single escrow transaction by its UUID. The authenticated user must be either the payer or the payee of the transaction.',
  })
  @ApiParam({
    name: 'id',
    description: 'Escrow transaction UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({
    description: 'Escrow transaction details',
    schema: {
      properties: {
        id: { type: 'string', description: 'Escrow transaction ID (UUID)' },
        payer_id: { type: 'string', description: 'Payer user UUID' },
        payee_id: { type: 'string', description: 'Payee user UUID' },
        amount_coins: {
          type: 'number',
          description: 'Coin amount held in escrow',
        },
        status: {
          type: 'string',
          enum: ['held', 'released', 'refunded', 'cancelled'],
          description: 'Transaction status',
        },
        reason: { type: 'string', description: 'Reason for the escrow hold' },
        metadata: {
          type: 'object',
          description: 'Additional transaction metadata',
        },
        held_at: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Timestamp when escrow was held',
        },
        released_at: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Timestamp when escrow was released',
        },
        refunded_at: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Timestamp when escrow was refunded',
        },
        cancelled_at: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Timestamp when escrow was cancelled',
        },
        retry_count: {
          type: 'number',
          description: 'Number of retry attempts',
        },
        last_error: {
          type: 'string',
          nullable: true,
          description: 'Last error message if any',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp',
        },
        updated_at: {
          type: 'string',
          format: 'date-time',
          description: 'Last update timestamp',
        },
        degraded: {
          type: 'boolean',
          description: 'Whether the transaction is operating in degraded mode',
        },
        fallback_reason: {
          type: 'string',
          description: 'Reason for fallback mode if applicable',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Escrow transaction not found' })
  @ApiForbiddenResponse({
    description: 'Authenticated user is not a participant in this transaction',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<EscrowTransactionResponse> {
    return this.escrowService.getTransaction(id, req.user.sub);
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
        service: {
          type: 'string',
          example: 'escrow',
          description: 'Service name',
        },
        isOpen: {
          type: 'boolean',
          description:
            'Whether the circuit breaker is currently open (failing)',
        },
        failureCount: {
          type: 'number',
          description: 'Current consecutive failure count',
        },
        cooldownUntil: {
          type: 'number',
          description: 'Timestamp (ms) until circuit breaker cooldown ends',
        },
        totalFailures: {
          type: 'number',
          description: 'Total failures since last reset',
        },
        totalSuccesses: {
          type: 'number',
          description: 'Total successes since last reset',
        },
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
        reset: {
          type: 'boolean',
          example: true,
          description: 'Confirms the circuit breaker was reset',
        },
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
    const result = await this.crashReportService.acknowledgeReport(
      dto.report_id,
    );
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
