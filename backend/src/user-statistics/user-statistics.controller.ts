import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserStatisticsService } from './user-statistics.service';
import { UserStatisticsQueryDto } from './dto/user-statistics-query.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('user-statistics')
@UseGuards(SupabaseAuthGuard)
export class UserStatisticsController {
  constructor(private readonly userStatisticsService: UserStatisticsService) {}

  @Get(':userId')
  async getStatistics(
    @Param('userId') userId: string,
    @Query() query?: UserStatisticsQueryDto,
  ) {
    return this.userStatisticsService.getUserStatistics(userId, query);
  }
}
