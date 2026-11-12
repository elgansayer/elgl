import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  SubmitVerbAttemptDto,
  VerbSessionQueryDto,
} from './dto/verb-conjugation.dto';
import {
  PracticeProgressService,
  type PracticeProgressSummary,
} from './practice-progress.service';
import {
  VerbConjugationService,
  type VerbAttemptResult,
  type VerbLanguageSummary,
  type VerbSession,
} from './verb-conjugation.service';

@Controller('learning/verb-conjugation')
@UseGuards(SupabaseAuthGuard)
export class VerbConjugationController {
  constructor(
    private readonly verbConjugationService: VerbConjugationService,
    private readonly practiceProgressService: PracticeProgressService,
  ) {}

  @Get('languages')
  listLanguages(): VerbLanguageSummary[] {
    return this.verbConjugationService.listLanguages();
  }

  @Get('session')
  getSession(@Query() query: VerbSessionQueryDto): VerbSession {
    return this.verbConjugationService.getSession(
      query.language,
      query.tense,
      query.limit,
    );
  }

  @Post('attempts')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async submitAttempt(
    @CurrentUser() user: User | null,
    @Body() dto: SubmitVerbAttemptDto,
  ): Promise<VerbAttemptResult> {
    if (!user) throw new UnauthorizedException();
    const result = this.verbConjugationService.checkAnswer(
      dto.exerciseId,
      dto.answer,
    );
    await this.practiceProgressService.recordAttempt({
      userId: user.id,
      module: 'verb_conjugation',
      itemId: dto.exerciseId,
      languageCode: result.languageCode,
      submittedAnswer: result.submitted,
      correct: result.correct,
    });
    return result;
  }

  @Get('progress')
  async getProgress(
    @CurrentUser() user: User | null,
  ): Promise<PracticeProgressSummary> {
    if (!user) throw new UnauthorizedException();
    return this.practiceProgressService.summarise(user.id, 'verb_conjugation');
  }
}
