import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { QuizService, QuizResultRequest, QuizResultResponse, QuizQuestion } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query('language') language: string): Promise<QuizQuestion[]> {
    return this.quizService.getQuestions(language || 'en');
  }

  @Post('evaluate')
  evaluateResults(@Body() body: QuizResultRequest): Promise<QuizResultResponse> {
    return this.quizService.evaluateResults(body.language, body.answers);
  }
}
