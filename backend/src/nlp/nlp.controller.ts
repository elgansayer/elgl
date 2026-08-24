import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_NO_STORE,
  CACHE_PRIVATE_SHORT,
  CACHE_PUBLIC_SHORT,
} from '../common/cache.interceptor';
import { UsersService } from '../users/users.service';
import { GrammarCheckDto } from './dto/grammar-check.dto';
import { PronunciationScoreDto } from './dto/pronunciation-score.dto';
import { TranslateDto } from './dto/translate.dto';
import { TranslateUiDto } from './dto/translate-ui.dto';
import { ExplainGrammarDto } from './dto/explain-grammar.dto';
import { SimplifyDto } from './dto/simplify.dto';
import { TranslateBioDto } from './dto/translate-bio.dto';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import {
  GrammarCheckResult,
  PronunciationScoreResult,
  TranslationResult,
  TranslateUiResult,
} from './interfaces/nlp-results.interface';
import { NlpService } from './nlp.service';
import { NlpRateLimit, NlpRateLimiterGuard } from './nlp-rate-limiter.guard';

@Controller('nlp')
@UseGuards(SupabaseAuthGuard, NlpRateLimiterGuard)
export class NlpController {
  constructor(
    private readonly nlpService: NlpService,
    private readonly usersService: UsersService,
    private readonly grammarCheckService: GrammarCheckService,
    private readonly grammarExplanationService: GrammarExplanationService,
  ) {}

  /**
   * Language detection is deterministic for the same input text.
   * Client-side caching helps avoid redundant API calls.
   */
  @Post('detect-language')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_SHORT))
  detectLanguage(@Body() body: { text?: string }): {
    language: string;
    confidence: number;
  } {
    return this.nlpService.detectLanguage(body.text || '');
  }

  /**
   * Translation: mutation-like (counts toward rate limit), no-store.
   */
  @Post('translate')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
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

  /**
   * UI translations are cached in Redis and change rarely.
   * Edge caching reduces load on the DeepL integration.
   */
  @Post('translate-ui')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  async translateUi(@Body() dto: TranslateUiDto): Promise<TranslateUiResult> {
    return await this.nlpService.translateUi(dto);
  }

  /**
   * Grammar check: mutation (counts toward rate limit), no-store.
   */
  @Post('grammar-check')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async grammarCheck(
    @CurrentUser() user: User | null,
    @Body() dto: GrammarCheckDto,
  ): Promise<GrammarCheckResult | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    await this.nlpService.checkRateLimit(user.id, profile?.is_vip ?? false);
    return await this.grammarCheckService.check(dto);
  }

  /**
   * Grammar explanation: mutation (counts toward rate limit), no-store.
   */
  @Post('explain-grammar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async explainGrammar(
    @CurrentUser() user: User | null,
    @Body() dto: ExplainGrammarDto,
  ): Promise<{
    original: string;
    corrected: string;
    explanation: string;
  } | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    await this.nlpService.checkRateLimit(user.id, profile?.is_vip ?? false);
    return await this.grammarExplanationService.explain(dto);
  }

  /**
   * Pronunciation scoring: mutation (counts toward rate limit), no-store.
   */
  @Post('pronunciation-score')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
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

  /**
   * Simplification: mutation (counts toward rate limit), no-store.
   */
  @Post('simplify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async simplify(
    @CurrentUser() user: User | null,
    @Body() dto: SimplifyDto,
  ): Promise<{ original: string; simplified: string } | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.simplify(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }

  /**
   * Combined translate + correct: mutation, no-store.
   */
  @Post('translate-and-correct')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 15, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async translateAndCorrect(
    @CurrentUser() user: User | null,
    @Body() dto: TranslateDto,
  ) {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.translateAndCorrect(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }

  /**
   * Bio translation: mutation (counts toward rate limit), no-store.
   */
  @Post('translate-bio')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @NlpRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async translateBio(
    @CurrentUser() user: User | null,
    @Body() dto: TranslateBioDto,
  ): Promise<{
    original_text: string;
    translated_text: string;
    detected_language: string;
  } | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return await this.nlpService.translateBio(
      user.id,
      profile?.is_vip ?? false,
      dto,
    );
  }

  /**
   * Audio transcription: mutation (counts toward rate limit), no-store.
   */
  @Post('transcribe-audio')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async transcribeAudio(
    @Body() dto: TranscribeAudioDto,
  ): Promise<{ transcription: string; language: string }> {
    return await this.nlpService.transcribeAudio(dto);
  }
}
