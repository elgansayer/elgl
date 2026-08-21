import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
import { ModerationItem, ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';

@ApiTags('Moderation')
@ApiBearerAuth('bearer')
@Controller('moderation')
@UseGuards(SupabaseAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('items')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'List moderation queue items',
    description:
      'Returns moderation queue items filtered by type (moment or profile) and optional status. Moment reports include the attached moment content text and author name.',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    description: 'Report type to filter by',
    enum: ['moment', 'profile'],
    example: 'moment',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filter by report status (e.g., "pending", "approved", "rejected")',
    example: 'pending',
  })
  @ApiOkResponse({
    description: 'Moderation items returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Report record ID (UUID)' },
          status: {
            type: 'string',
            description: 'Report status: pending, approved, or rejected',
          },
          reason: {
            type: 'string',
            description: 'Reason category for the report',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Report creation timestamp',
          },
          description: {
            type: 'string',
            nullable: true,
            description: 'Additional report description',
          },
          reporter: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', description: 'Reporter user ID' },
              display_name: {
                type: 'string',
                description: 'Reporter display name',
              },
            },
          },
          reported_user: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', description: 'Reported user ID' },
              display_name: {
                type: 'string',
                description: 'Reported user display name',
              },
            },
          },
          reportedMomentId: {
            type: 'string',
            nullable: true,
            description: 'Reported moment ID if applicable',
          },
          moment_content: {
            type: 'string',
            nullable: true,
            description: 'Content text of the reported moment',
          },
          momentAuthorName: {
            type: 'string',
            nullable: true,
            description: 'Display name of the moment author',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid type parameter' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (30 req/min)',
  })
  async getItems(
    @Query('type') type: 'moment' | 'profile',
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ModerationItem[]> {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedPageSize = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.moderationService.getItems(
      type,
      status,
      parsedPage,
      parsedPageSize,
    );
  }

  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Report a user',
    description:
      'Creates a new report against a user. The authenticated user becomes the reporter. The report status is set to "pending" for moderator review.',
  })
  @ApiCreatedResponse({
    description: 'Report created successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Report record ID (UUID)' },
          reporter_id: { type: 'string', description: 'Reporter user UUID' },
          reported_user_id: {
            type: 'string',
            description: 'Reported user UUID',
          },
          reason_category: { type: 'string', description: 'Reason category' },
          description: { type: 'string', nullable: true },
          status: {
            type: 'string',
            description: 'Report status (always "pending")',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid report payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (5 req/min)',
  })
  async reportUser(
    @Req() req: { user: { id: string } },
    @Body() dto: ReportUserDto,
  ) {
    return this.moderationService.reportUser(req.user.id, dto);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Approve a moderation item',
    description:
      'Marks a report as "approved", indicating the flagged content has been reviewed and deemed acceptable.',
  })
  @ApiOkResponse({
    description: 'Item approved successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid moderation action payload' })
  @ApiNotFoundResponse({ description: 'Report item not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({
    description: 'User does not have moderator privileges',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (10 req/min)',
  })
  async approve(@Body() dto: ModerationActionDto) {
    return this.moderationService.approveItem(dto);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reject a moderation item',
    description:
      'Marks a report as "rejected" with an optional reason. The reported content will be hidden or removed.',
  })
  @ApiOkResponse({
    description: 'Item rejected successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid moderation action payload' })
  @ApiNotFoundResponse({ description: 'Report item not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({
    description: 'User does not have moderator privileges',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (10 req/min)',
  })
  async reject(@Body() dto: ModerationActionDto) {
    return this.moderationService.rejectItem(dto);
  }

  @Get('analyse/:userId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Analyse user for dating behaviour risk',
    description:
      'Analyses a user profile (display name, bio, status, greeting, target/native languages) and their last 20 moments for dating-related keywords. Returns a risk score (0-100) and a list of matched dating flags. A higher score indicates a higher likelihood of dating/app-romance behaviour.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID to analyse',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({
    description: 'User analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        riskScore: {
          type: 'number',
          description:
            'Risk score from 0 to 100. Higher values indicate stronger dating-behaviour signals.',
          minimum: 0,
          maximum: 100,
          example: 42,
        },
        flags: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of matched dating-related keywords found in the user content',
          example: ['dating', 'relationship', 'single'],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (5 req/min)',
  })
  async analyseUser(@Param('userId') userId: string) {
    return this.moderationService.analyseUserForDatingBehaviour(userId);
  }
}
