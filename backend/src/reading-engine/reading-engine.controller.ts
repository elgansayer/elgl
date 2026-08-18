import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReadingEngineService } from './reading-engine.service';
import { CreateReadingResourceDto } from './dto/create-reading-resource.dto';
import { UpdateReadingResourceDto } from './dto/update-reading-resource.dto';
import {
  ReadingResource,
  ReadingProgress,
  ReadingTokenBreakdown,
} from './interfaces/reading.interface';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; sub?: string };
}

@ApiTags('LingQ Reading Engine')
@Controller('reading')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class ReadingEngineController {
  constructor(private readonly readingService: ReadingEngineService) {}

  /** Extract the authenticated user id from the request. */
  private getUserId(req: AuthenticatedRequest): string {
    return req.user?.id ?? req.user?.sub ?? 'anonymous';
  }

  /* ---- Resources ---- */

  @Post('resources')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new reading resource' })
  @ApiResponse({ status: 201, description: 'Resource created.' })
  async createResource(
    @Body() dto: CreateReadingResourceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ReadingResource> {
    return this.readingService.createResource(this.getUserId(req), dto);
  }

  @Get('resources')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'List reading resources with filters' })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'difficulty', required: false })
  @ApiQuery({ name: 'topic', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listResources(
    @Query('language') language?: string,
    @Query('difficulty') difficulty?: string,
    @Query('topic') topic?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ReadingResource[]> {
    return this.readingService.listResources({
      language,
      difficulty,
      topic,
      limit,
      offset,
    });
  }

  @Get('resources/:id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a single reading resource by id' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  async getResource(@Param('id') id: string): Promise<ReadingResource> {
    return this.readingService.getResource(id);
  }

  @Put('resources/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Update a reading resource' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  async updateResource(
    @Param('id') id: string,
    @Body() dto: UpdateReadingResourceDto,
  ): Promise<ReadingResource> {
    return this.readingService.updateResource(id, dto);
  }

  @Delete('resources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete a reading resource' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  @ApiResponse({ status: 204, description: 'Resource deleted.' })
  async deleteResource(@Param('id') id: string): Promise<void> {
    await this.readingService.deleteResource(id);
  }

  /* ---- Token Breakdown ---- */

  @Get('resources/:id/tokenise')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Tokenise a reading resource using Intl.Segmenter' })
  @ApiParam({ name: 'id', description: 'Resource UUID' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'ISO 639-1 language override',
  })
  async tokenise(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ): Promise<ReadingTokenBreakdown> {
    return this.readingService.tokenise(this.getUserId(req), id, lang);
  }

  /* ---- Progress ---- */

  @Get('progress')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get current reading progress for authenticated user',
  })
  async getProgress(
    @Req() req: AuthenticatedRequest,
  ): Promise<ReadingProgress> {
    return this.readingService.getProgress(this.getUserId(req));
  }

  @Post('progress/session')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Record a completed reading session' })
  async recordSession(
    @Body()
    body: { resourceId: string; wordsRead: number; durationSeconds: number },
    @Req() req: AuthenticatedRequest,
  ): Promise<ReadingProgress> {
    return this.readingService.recordSession(this.getUserId(req), body);
  }

  /* ---- Cache Admin ---- */

  @Delete('cache/user')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Clear all reading-engine caches for the authenticated user',
  })
  async clearUserCache(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.readingService.clearUserCaches(this.getUserId(req));
  }
}
