import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top-correctors')
  async getTopCorrectors(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.leaderboardService.getTopCorrectors(parsedLimit);
  }
}
