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
} from '@nestjs/common';
import { HobbyTagsService, VocabularyResultItem } from './hobby-tags.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';
import type { Request } from 'express';

@Controller('hobby-tags')
export class HobbyTagsController {
  constructor(private readonly hobbyTagsService: HobbyTagsService) {}

  /**
   * Global hobby tag catalogue: public reference data that changes rarely.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  async getAllTags() {
    return this.hobbyTagsService.getAllTags();
  }

  /**
   * Create a global tag: admin-like mutation.
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async createGlobalTag(
    @Body() body: { name: string; category: string; icon?: string },
  ): Promise<any> {
    return this.hobbyTagsService.createTag(body.name, body.category, body.icon);
  }

  /**
   * User's own hobby tags: private, short-lived cache for reasonable freshness.
   */
  @Get('my')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  async getMyTags(@Req() req: { user?: { id: string } }): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.getUserTags(userId as string);
  }

  /**
   * Add a user tag: mutation.
   */
  @Post('my')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async addTag(
    @Req() req: { user?: { id: string } },
    @Body() body: { hobby_tag_id: string; proficiency_level?: number },
  ): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.addUserTag(
      userId as string,
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
    @Req() req: { user?: { id: string } },
    @Param('hobbyTagId') hobbyTagId: string,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    await this.hobbyTagsService.removeUserTag(userId as string, hobbyTagId);
    return { message: 'Hobby tag removed successfully' };
  }

  /**
   * Update proficiency: mutation.
   */
  @Patch('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async updateProficiency(
    @Req() req: { user?: { id: string } },
    @Param('hobbyTagId') hobbyTagId: string,
    @Body() body: { proficiency_level: number },
  ): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.updateProficiency(
      userId as string,
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
    @Req() req: { user?: { id: string } },
    @Query('language') language: string,
  ): Promise<VocabularyResultItem[]> {
    const userId = req.user?.id;
    return this.hobbyTagsService.getVocabularyForUser(
      userId as string,
      language,
    );
  }
}
