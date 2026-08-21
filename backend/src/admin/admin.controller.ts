import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RequireAdminCapabilities } from './decorators/require-admin-capabilities.decorator';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  AdminBlocksListResult,
  AdminReportsListResult,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Admin - Users')
@ApiTags('Admin - Blocks')
@ApiBearerAuth('bearer')
@Controller('admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.read')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'List platform users',
    description:
      'Returns a paginated list of all platform users with search and filtering capabilities. Results are cached for 5 minutes.',
  })
  @ApiOkResponse({
    description: 'Paginated list of users returned successfully',
    schema: {
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique user identifier (UUID)',
              },
              display_name: {
                type: 'string',
                nullable: true,
                description: 'User display name',
              },
              avatar_url: {
                type: 'string',
                nullable: true,
                description: 'Avatar image URL',
              },
              native_languages: {
                type: 'array',
                items: { type: 'string' },
                nullable: true,
              },
              target_languages: {
                type: 'array',
                items: { type: 'string' },
                nullable: true,
              },
              is_vip: { type: 'boolean', nullable: true },
              vip_tier: { type: 'string', nullable: true },
              is_admin: { type: 'boolean', nullable: true },
              coins_balance: { type: 'number', nullable: true },
              study_streak_days: { type: 'number', nullable: true },
              last_active_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              created_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
            },
          },
        },
        total: {
          type: 'number',
          description: 'Total number of users matching the query',
        },
        page: { type: 'number', description: 'Current page number' },
        pageSize: { type: 'number', description: 'Number of items per page' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (30 req/min)',
  })
  async listUsers(
    @Query() query: AdminUserQueryDto,
  ): Promise<AdminUserListResult> {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/vip')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Set VIP status for a user',
    description:
      'Update the VIP status and tier for a specific user. Invalidates cached user lists and login history.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({ description: 'VIP status updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid VIP payload' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (5 req/min)',
  })
  async setVipStatus(
    @Param('id') id: string,
    @Body() dto: ToggleVipDto,
  ): Promise<AdminUserSummary> {
    return this.adminService.setVipStatus(id, dto);
  }

  @Get('users/:id/login-history')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('users.sessions.read')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get login history for a user',
    description:
      'Returns the last 50 login events for a user, including IP address and user agent. Results are cached for 10 minutes.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({
    description: 'Login history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Login history entry ID (UUID)' },
          user_id: { type: 'string', description: 'User UUID' },
          ip_address: {
            type: 'string',
            nullable: true,
            description: 'Client IP address',
          },
          user_agent: {
            type: 'string',
            nullable: true,
            description: 'Client user agent string',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Login timestamp',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (15 req/min)',
  })
  async getLoginHistory(@Param('id') id: string): Promise<LoginHistoryEntry[]> {
    return this.adminService.getLoginHistory(id);
  }

  @Post('users/:id/ban')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Ban a user',
    description:
      'Bans a user by creating a block record from the admin user. Invalidates cached user lists and blocks.',
  })
  @ApiParam({
    name: 'id',
    description: 'Target user UUID to ban',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiCreatedResponse({
    description: 'User banned successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'User banned' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Target user not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (5 req/min)',
  })
  async banUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.banUser(id, adminUserId);
    return { message: 'User banned' };
  }

  @Post('users/:id/warn')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Warn a user',
    description:
      'Issues a formal warning to a user by creating an admin-warning report record. Invalidates cached user lists.',
  })
  @ApiParam({
    name: 'id',
    description: 'Target user UUID to warn',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiCreatedResponse({
    description: 'User warned successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'User warned' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Target user not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (5 req/min)',
  })
  async warnUser(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ message: string }> {
    const adminUserId = req.user.sub;
    await this.adminService.warnUser(id, adminUserId);
    return { message: 'User warned' };
  }

  @Get('blocks')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.read')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List all blocked user relationships',
    description:
      'Returns a paginated list of all block relationships across the platform with blocker and blocked user details. Results are cached for 5 minutes.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
    example: '1',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Items per page (default 20)',
    example: '20',
  })
  @ApiOkResponse({
    description: 'Paginated list of blocks returned successfully',
    schema: {
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Block record ID (UUID)' },
              blocker_id: { type: 'string', description: 'Blocker user UUID' },
              blocked_id: { type: 'string', description: 'Blocked user UUID' },
              blocker_name: {
                type: 'string',
                nullable: true,
                description: 'Blocker display name',
              },
              blocked_name: {
                type: 'string',
                nullable: true,
                description: 'Blocked user display name',
              },
              blocker_avatar: {
                type: 'string',
                nullable: true,
                description: 'Blocker avatar URL',
              },
              blocked_avatar: {
                type: 'string',
                nullable: true,
                description: 'Blocked user avatar URL',
              },
              created_at: {
                type: 'string',
                format: 'date-time',
                description: 'Block creation timestamp',
              },
            },
          },
        },
        total: { type: 'number', description: 'Total number of blocks' },
        page: { type: 'number', description: 'Current page number' },
        pageSize: { type: 'number', description: 'Number of items per page' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (20 req/min)',
  })
  async listAllBlocks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<AdminBlocksListResult> {
    return this.adminService.listAllBlocks(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('reports')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.read')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List all reports',
    description:
      'Returns a paginated list of all reports across the platform with reporter and reported user details. Optionally filter by status. Results are cached for 5 minutes. Uses idx_reports_status_created_at and idx_reports_reported_user_status indices.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
    example: '1',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Items per page (default 20)',
    example: '20',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by report status (pending, open, resolved)',
    example: 'pending',
  })
  @ApiOkResponse({
    description: 'Paginated list of reports returned successfully',
    schema: {
      properties: {
        reports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Report record ID (UUID)' },
              reporter_id: {
                type: 'string',
                nullable: true,
                description: 'Reporter user UUID',
              },
              reported_user_id: {
                type: 'string',
                description: 'Reported user UUID',
              },
              reason_category: {
                type: 'string',
                description: 'Report reason category',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Report description',
              },
              status: {
                type: 'string',
                description: 'Report status (pending, open, resolved)',
              },
              reported_name: {
                type: 'string',
                nullable: true,
                description: 'Reported user display name',
              },
              reporter_name: {
                type: 'string',
                nullable: true,
                description: 'Reporter display name',
              },
              created_at: {
                type: 'string',
                format: 'date-time',
                description: 'Report creation timestamp',
              },
            },
          },
        },
        total: { type: 'number', description: 'Total number of reports' },
        page: { type: 'number', description: 'Current page number' },
        pageSize: { type: 'number', description: 'Number of items per page' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (20 req/min)',
  })
  async listReports(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ): Promise<AdminReportsListResult> {
    return this.adminService.listReports(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      status,
    );
  }

  @Delete('blocks/:blockId')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapabilities('moderation.cases.manage')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Remove a block relationship',
    description:
      'Deletes a block record by its ID. Invalidates cached block lists.',
  })
  @ApiParam({
    name: 'blockId',
    description: 'Block record UUID to remove',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({
    description: 'Block removed successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Block record not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not an admin' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (10 req/min)',
  })
  async removeBlock(
    @Param('blockId') blockId: string,
  ): Promise<{ success: boolean }> {
    return this.adminService.removeBlock(blockId);
  }
}
