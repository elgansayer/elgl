import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';
import { CuratedContentService } from './curated-content.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { CreateDialogueDto } from './dto/create-dialogue.dto';

/**
 * LingQ-style curated reading content (articles and dialogues).
 *
 * Cache strategy:
 *  - Reading content changes rarely -- articles and dialogues use
 *    long-lived public CDN caches (24h CDN, 1 week stale-while-revalidate).
 *  - Mutation endpoints (POST) use no-store to prevent stale writes.
 */
@ApiTags('LingQ Reading Engine / Curated Content')
@Controller('curated-content')
export class CuratedContentController {
  constructor(private readonly service: CuratedContentService) {}

  @Get('articles')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'List curated reading articles',
    description:
      'Returns reading articles filtered by target language and/or CEFR proficiency level (A1-C2). Articles are public and cached at the CDN edge for fast repeat reads.',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description:
      'ISO 639-1 language code to filter articles by (e.g. fr, es, ja).',
    example: 'fr',
  })
  @ApiQuery({
    name: 'cefr_level',
    required: false,
    description:
      'CEFR proficiency level filter. One of: A1, A2, B1, B2, C1, C2.',
    example: 'B1',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of curated articles matching the filters.',
  })
  async getArticles(
    @Query('language') language?: string,
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.service.getArticles(language, cefrLevel);
  }

  @Get('articles/:id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get a single curated article by ID',
    description:
      'Returns the full article object including content text, audio URL, and metadata for the reading interface.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the curated article',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Full curated article object with reading content.',
  })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async getArticleById(@Param('id') id: string) {
    return this.service.getArticleById(id);
  }

  @Post('articles')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Create a new curated article',
    description:
      'Creates a new reading article with CEFR levelling, language tagging, and optional audio/image URLs. Requires authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Curated article created successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createArticle(@Body() dto: CreateArticleDto) {
    return this.service.createArticle(dto);
  }

  @Get('dialogues')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'List curated dialogues',
    description:
      'Returns dialogue/role-play content filtered by target language and/or CEFR level. Each dialogue contains lines spoken by different speakers, suitable for paired reading practice.',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'ISO 639-1 language code to filter dialogues by.',
    example: 'es',
  })
  @ApiQuery({
    name: 'cefr_level',
    required: false,
    description: 'CEFR proficiency level filter.',
    example: 'A2',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of curated dialogues matching the filters.',
  })
  async getDialogues(
    @Query('language') language?: string,
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.service.getDialogues(language, cefrLevel);
  }

  @Get('dialogues/:id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get a single curated dialogue by ID',
    description:
      'Returns the full dialogue object including all speaker lines with optional translations for each.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the curated dialogue',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Full curated dialogue object with speaker lines.',
  })
  @ApiResponse({ status: 404, description: 'Dialogue not found.' })
  async getDialogueById(@Param('id') id: string) {
    return this.service.getDialogueById(id);
  }

  @Post('dialogues')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Create a new curated dialogue',
    description:
      'Creates a new dialogue with multiple speaker lines. Each line can include an optional translation. Requires authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Curated dialogue created successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createDialogue(@Body() dto: CreateDialogueDto) {
    return this.service.createDialogue(dto);
  }
}
