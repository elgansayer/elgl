import { Controller, Get, Query } from '@nestjs/common';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('questions')
  getQuestions(@Query('language') language: string) {
    return this.quizService.getQuestions(language || 'en');
  }
}
