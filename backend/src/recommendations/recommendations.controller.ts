import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { sanitiseRecommendationsData } from './sanitise-recommendations.helper';

interface AuthenticatedRequest {
  user?: { id: string };
}

@Controller('recommendations')
@UseGuards(SupabaseAuthGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('for-you')
  async getForYou(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    const results = await this.recommendationsService.getRecommendations(userId);
    return sanitiseRecommendationsData(results);
  }

  @Get('daily')
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    const results = await this.recommendationsService.getDailyRecommendations(userId);
    return sanitiseRecommendationsData(results);
  }
}
