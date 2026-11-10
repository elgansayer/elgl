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
  IpaQueryDto,
  IpaQuizQueryDto,
  SubmitIpaAttemptDto,
} from './dto/ipa-alphabet.dto';
import {
  IpaAlphabetService,
  type IpaAttemptResult,
  type IpaCatalogue,
  type IpaLanguageSummary,
  type IpaQuiz,
} from './ipa-alphabet.service';
import {
  PracticeProgressService,
  type PracticeProgressSummary,
} from './practice-progress.service';

@Controller('learning/ipa-alphabet')
@UseGuards(SupabaseAuthGuard)
export class IpaAlphabetController {
  constructor(
    private readonly ipaAlphabetService: IpaAlphabetService,
    private readonly practiceProgressService: PracticeProgressService,
  ) {}

  @Get('languages')
  listLanguages(): IpaLanguageSummary[] {
    return this.ipaAlphabetService.listLanguages();
  }

  @Get('catalogue')
  getCatalogue(@Query() query: IpaQueryDto): IpaCatalogue {
    return this.ipaAlphabetService.getCatalogue(query.language);
  }

  @Get('quiz')
  getQuiz(@Query() query: IpaQuizQueryDto): IpaQuiz {
    return this.ipaAlphabetService.getQuiz(query.language, query.limit);
  }

  @Post('attempts')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async submitAttempt(
    @CurrentUser() user: User | null,
    @Body() dto: SubmitIpaAttemptDto,
  ): Promise<IpaAttemptResult> {
    if (!user) throw new UnauthorizedException();
    const result = this.ipaAlphabetService.checkAnswer(
      dto.exerciseId,
      dto.answer,
    );
    await this.practiceProgressService.recordAttempt({
      userId: user.id,
      module: 'ipa_alphabet',
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
    return this.practiceProgressService.summarise(user.id, 'ipa_alphabet');
  }
}
