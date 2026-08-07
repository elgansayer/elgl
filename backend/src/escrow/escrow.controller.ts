import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  UnauthorizedException,
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
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
} from './dto/escrow.dto';
import {
  EscrowCacheInterceptor,
  ESCROW_CACHE_PRIVATE_SHORT,
  ESCROW_CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

@ApiTags('Escrow Payments')
@ApiBearerAuth('bearer')
@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

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
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.createEscrow(userId, dto);
  }

  /**
   * POST /escrow/release
   * Release escrowed coins to the payee.
   * Rate limited to 5 requests per minute.
   * Caching: no-store. This is a mutation.
   */
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
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.releaseEscrow(userId, dto.escrow_id);
  }

  /**
   * POST /escrow/refund
   * Refund escrowed coins back to the payer.
   * Rate limited to 5 requests per minute.
   * Caching: no-store. This is a mutation.
   */
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
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.refundEscrow(userId, dto.escrow_id);
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
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.listEscrows(
      userId,
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
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.getEscrow(userId, id);
  }
}
