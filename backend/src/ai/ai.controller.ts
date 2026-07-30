import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('scenarios')
  getScenarios() {
    return this.aiService.getScenarios();
  }

  @Post('message')
  async getMessage(
    @Body('message') message: string,
    @Body('scenarioId') scenarioId?: string,
  ) {
    return this.aiService.handleMessage(message, scenarioId);
  }
}
