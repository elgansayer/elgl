import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

interface QuizSubmission {
 score: number;
 maxScore: number;
 suggestedLevel: string;
 answers: Record<string, number>;
}

@Controller('quiz')
@UseGuards(SupabaseAuthGuard)
export class QuizController {
 constructor(private readonly quizService: QuizService) {}

 @Get('questions')
 getQuestions(@Query('language') language: string) {
  return this.quizService.getQuestions(language || 'en');
 }

 @Post('results')
 submitResults(@Body() results: QuizSubmission) {
  return this.quizService.submitResults(results);
 }
}
