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
import { QuizQuestionsQueryDto, SubmitQuizDto } from './dto/quiz.dto';
import { QuizService } from './quiz.service';

@Controller('quiz')
@UseGuards(SupabaseAuthGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query() query: QuizQuestionsQueryDto) {
    return this.quizService.getQuestions(query.language || 'en');
  }

  @Post('results')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitResults(
    @CurrentUser() user: User | null,
    @Body() results: SubmitQuizDto,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.quizService.submitResults(user.id, results);
  }
}
