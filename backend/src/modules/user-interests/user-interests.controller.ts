import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserInterestsService } from './user-interests.service';
import { UpdateInterestsDto } from './dto/update-interests.dto';

@Controller('user-interests')
@UseGuards(SupabaseAuthGuard)
export class UserInterestsController {
  constructor(private readonly interestsService: UserInterestsService) {}

  @Get('tags')
  async getUserInterests(@Req() req: any): Promise<{ tags: string[] }> {
    const userId = req.user.sub;
    const tags = await this.interestsService.getUserInterests(userId);
    return { tags };
  }

  @Post('tags')
  async updateUserInterests(
    @Req() req: any,
    @Body() dto: UpdateInterestsDto,
  ): Promise<{ success: boolean }> {
    const userId = req.user.sub;
    await this.interestsService.updateUserInterests(userId, dto.tags);
    return { success: true };
  }

  @Get('vocabulary')
  async getVocabulary(
    @Req() req: any,
    @Query('language') language: string,
  ): Promise<{ entries: any[] }> {
    const userId = req.user.sub;
    const userTags = await this.interestsService.getUserInterests(userId);
    if (userTags.length === 0) return { entries: [] };
    const entries = await this.interestsService.getVocabularyForInterests(
      userTags,
      language,
    );
    return { entries };
  }
}
