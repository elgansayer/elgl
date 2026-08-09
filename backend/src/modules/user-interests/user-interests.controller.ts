import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  UserInterestsService,
  VocabularyEntry,
} from './user-interests.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';

type AuthenticatedRequest = { user?: { id: string } };

@Controller('user-interests')
@UseGuards(SupabaseAuthGuard)
export class UserInterestsController {
  constructor(private readonly interestsService: UserInterestsService) {}

  @Get('tags')
  async getUserInterests(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ tags: string[] }> {
    const userId = req.user?.id ?? '';
    const tags = await this.interestsService.getUserInterests(userId);
    return { tags };
  }

  @Post('tags')
  async updateUserInterests(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateInterestsDto,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id ?? '';
    await this.interestsService.updateUserInterests(userId, dto.tags);
    return { success: true };
  }

  @Get('vocabulary')
  async getVocabulary(
    @Req() req: AuthenticatedRequest,
    @Query('language') language: string,
  ): Promise<{ entries: VocabularyEntry[] }> {
    const userId = req.user?.id ?? '';
    const userTags = await this.interestsService.getUserInterests(userId);
    if (userTags.length === 0) return { entries: [] };
    const entries = await this.interestsService.getVocabularyForInterests(
      userTags,
      language,
    );
    return { entries };
  }
}
