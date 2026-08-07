import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { QuizService, QuizResultRequest, QuizResultResponse } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query('language') language: string) {
    return this.quizService.getQuestions(language || 'en');
  }

  @Post('evaluate')
  evaluateResults(@Body() body: QuizResultRequest): QuizResultResponse {
    return this.quizService.evaluateResults(body.language, body.answers);
  }
}
