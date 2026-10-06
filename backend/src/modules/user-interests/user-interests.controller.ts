import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  UserInterestsService,
  VocabularyEntry,
} from './user-interests.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import type { User } from '@supabase/supabase-js';

@Controller('user-interests')
@UseGuards(SupabaseAuthGuard)
export class UserInterestsController {
  constructor(private readonly interestsService: UserInterestsService) {}

  @Get('tags')
  async getUserInterests(
    @CurrentUser() user: User | null,
  ): Promise<{ tags: string[] }> {
    if (!user?.id) throw new UnauthorizedException();
    const tags = await this.interestsService.getUserInterests(user.id);
    return { tags };
  }

  @Post('tags')
  async updateUserInterests(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateInterestsDto,
  ): Promise<{ success: boolean }> {
    if (!user?.id) throw new UnauthorizedException();
    await this.interestsService.updateUserInterests(user.id, dto.tags);
    return { success: true };
  }

  @Get('vocabulary')
  async getVocabulary(
    @CurrentUser() user: User | null,
    @Query('language') language: string,
  ): Promise<{ entries: VocabularyEntry[] }> {
    if (!user?.id) throw new UnauthorizedException();
    const userTags = await this.interestsService.getUserInterests(user.id);
    if (userTags.length === 0) return { entries: [] };
    const entries = await this.interestsService.getVocabularyForInterests(
      userTags,
      language,
    );
    return { entries };
  }
}
