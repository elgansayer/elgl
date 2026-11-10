import { Controller, Get, Query } from '@nestjs/common';
import {
  LeaderboardService,
  Corrector,
  WeeklyLeaderboard,
} from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top-correctors')
  async getTopCorrectors(@Query('limit') limit?: string): Promise<Corrector[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.leaderboardService.getTopCorrectors(parsedLimit);
  }

  @Get('weekly')
  async getWeeklyLeaderboard(
    @Query('limit') limit?: string,
  ): Promise<WeeklyLeaderboard> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.leaderboardService.getWeeklyLeaderboard(parsedLimit);
  }
}
