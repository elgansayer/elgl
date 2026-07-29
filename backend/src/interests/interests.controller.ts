import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { InterestsService } from './interests.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    target_languages?: string[];
  };
}

@Controller('interests')
@UseGuards(SupabaseAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async listInterests(@Req() req: AuthenticatedRequest) {
    const rawLang = req.query?.language;
    const targetLanguage = typeof rawLang === 'string' ? rawLang : 'en';
    return this.interestsService.findAll(targetLanguage);
  }

  @Post('select')
  async selectInterests(
    @Body('interestIds') interestIds: string[],
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const targetLanguage = req.user?.target_languages?.[0] ?? 'en';
    await this.interestsService.setUserInterests(userId, interestIds);
    await this.interestsService.generateFlashcards(userId, targetLanguage);
    return { success: true };
  }
}
