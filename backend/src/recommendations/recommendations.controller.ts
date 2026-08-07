import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';

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
    return this.recommendationsService.getRecommendations(userId);
  }

  @Get('daily')
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getDailyRecommendations(userId);
  }
}
