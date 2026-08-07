import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { QuizService, QuizResults } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query('language') language: string) {
    return this.quizService.getQuestions(language || 'en');
  }

  @Post('results')
  submitResults(@Body() results: QuizResults) {
    return this.quizService.submitResults(results);
  }
}
