import { Controller, Get, Query } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get('questions')
  getQuestions(@Query('language') language: string) {
    return this.assessmentsService.getQuestions(language || 'en');
  }
}
