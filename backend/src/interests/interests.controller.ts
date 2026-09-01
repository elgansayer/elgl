import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { InterestsService } from './interests.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';
import { SelectInterestsDto } from './dto/select-interests.dto';

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

  /**
   * Interest catalogue is public, reference data that changes rarely.
   * Long-lived CDN cache reduces DB pressure for listing interests.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  async listInterests(@Query('language') language: string) {
    const targetLanguage = language || 'en';
    return this.interestsService.findAll(targetLanguage);
  }

  /**
   * Interest selection: mutation that triggers flashcard generation.
   */
  @Post('select')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async selectInterests(
    @Body() body: SelectInterestsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const targetLanguage = req.user?.target_languages?.[0] ?? 'en';
    const interestTags = Array.isArray(body.interestTags)
      ? body.interestTags
      : await this.interestsService.resolveLegacyInterestIds(
          Array.isArray(body.interestIds) ? body.interestIds : [],
        );
    await this.interestsService.setUserInterests(userId, interestTags);
    await this.interestsService.generateFlashcards(userId, targetLanguage);
    return { success: true };
  }
}
