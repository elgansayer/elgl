import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { HobbyTagsService, VocabularyResultItem } from './hobby-tags.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';
import {
  AddUserHobbyTagDto,
  CreateHobbyTagDto,
  HobbyVocabularyQueryDto,
  ListHobbyTagsQueryDto,
  UpdateHobbyProficiencyDto,
} from './dto/hobby-tags.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('hobby-tags')
export class HobbyTagsController {
  constructor(private readonly hobbyTagsService: HobbyTagsService) {}

  /**
   * Global hobby tag catalogue: public reference data that changes rarely.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  async getAllTags(@Query() query: ListHobbyTagsQueryDto): Promise<unknown[]> {
    return this.hobbyTagsService.getAllTags(query.category, query.limit);
  }

  /**
   * Create a global tag: admin-like mutation.
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async createGlobalTag(@Body() body: CreateHobbyTagDto): Promise<unknown> {
    return this.hobbyTagsService.createTag(body.name, body.category, body.icon);
  }

  /**
   * User's own hobby tags: private, short-lived cache for reasonable freshness.
   */
  @Get('my')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  async getMyTags(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.hobbyTagsService.getUserTags(req.user.id);
  }

  /**
   * Add a user tag: mutation.
   */
  @Post('my')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async addTag(
    @Req() req: AuthenticatedRequest,
    @Body() body: AddUserHobbyTagDto,
  ): Promise<unknown> {
    return this.hobbyTagsService.addUserTag(
      req.user.id,
      body.hobby_tag_id,
      body.proficiency_level,
    );
  }

  /**
   * Remove a user tag: mutation.
   */
  @Delete('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async removeTag(
    @Req() req: AuthenticatedRequest,
    @Param('hobbyTagId', new ParseUUIDPipe({ version: '4' }))
    hobbyTagId: string,
  ): Promise<{ success: true }> {
    await this.hobbyTagsService.removeUserTag(req.user.id, hobbyTagId);
    return { success: true };
  }

  /**
   * Update proficiency: mutation.
   */
  @Patch('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async updateProficiency(
    @Req() req: AuthenticatedRequest,
    @Param('hobbyTagId', new ParseUUIDPipe({ version: '4' }))
    hobbyTagId: string,
    @Body() body: UpdateHobbyProficiencyDto,
  ): Promise<unknown> {
    return this.hobbyTagsService.updateProficiency(
      req.user.id,
      hobbyTagId,
      body.proficiency_level,
    );
  }

  /**
   * User vocabulary: private, medium-lived cache.
   * Translating vocabulary via DeepL is expensive; cache aggressively.
   */
  @Get('vocabulary')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  async getVocabulary(
    @Req() req: AuthenticatedRequest,
    @Query() query: HobbyVocabularyQueryDto,
  ): Promise<VocabularyResultItem[]> {
    return this.hobbyTagsService.getVocabularyForUser(
      req.user.id,
      query.language,
    );
  }
}
