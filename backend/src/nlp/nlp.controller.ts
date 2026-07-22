import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from '../users/users.service';
import { GrammarCheckDto } from './dto/grammar-check.dto';
import { PronunciationScoreDto } from './dto/pronunciation-score.dto';
import { TranslateDto } from './dto/translate.dto';
import { TranslateUiDto } from './dto/translate-ui.dto';
import {
  GrammarCheckResult,
  PronunciationScoreResult,
  TranslationResult,
  TranslateUiResult,
} from './interfaces/nlp-results.interface';
import { NlpService } from './nlp.service';

@Controller('nlp')
@UseGuards(SupabaseAuthGuard)
export class NlpController {
  constructor(
    private readonly nlpService: NlpService,
    private readonly usersService: UsersService,
  ) {}

  @Post('detect-language')
  detectLanguage(@Body() body: { text?: string }): {
    language: string;
    confidence: number;
  } {
    return this.nlpService.detectLanguage(body.text || '');
  }

  @Post('translate')
  async translate(
    @CurrentUser() user: User | null,
    @Body() dto: TranslateDto,
  ): Promise<TranslationResult | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.translate(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }

  @Post('translate-ui')
  async translateUi(@Body() dto: TranslateUiDto): Promise<TranslateUiResult> {
    return await this.nlpService.translateUi(dto);
  }

  @Post('grammar-check')
  async grammarCheck(
    @CurrentUser() user: User | null,
    @Body() dto: GrammarCheckDto,
  ): Promise<GrammarCheckResult | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.grammarCheck(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }

  @Post('pronunciation-score')
  async pronunciationScore(
    @CurrentUser() user: User | null,
    @Body() dto: PronunciationScoreDto,
  ): Promise<PronunciationScoreResult | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.pronunciationScore(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }
}
