import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';

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

  @Post('conversation-analysis')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(200)
  async getConversationAnalysis(
    @CurrentUser() user: User | null,
    @Body('conversationText') conversationText: string,
  ) {
    if (!user) {
      return null;
    }
    if (!conversationText || typeof conversationText !== 'string') {
      throw new BadRequestException('conversationText is required');
    }
    return await this.aiService.getConversationAnalysisReport(
      user.id,
      conversationText,
    );
  }
}
