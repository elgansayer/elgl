import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PerformanceReportQueryDto } from './dto/performance-report-query.dto';
import { PerformanceReportService } from './performance-report.service';
import type { PerformanceReportResponse } from './performance-report.types';
import { StatsService, MyStatsResponse } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly performanceReportService: PerformanceReportService,
  ) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  async getMyStats(
    @Req() req: { user: { sub: string } },
  ): Promise<MyStatsResponse> {
    const userId = req.user.sub;
    return this.statsService.getStats(userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me/report')
  @Header('Cache-Control', 'private, no-store')
  async getMyPerformanceReport(
    @Req() req: { user?: { id?: string; sub?: string } },
    @Query() query: PerformanceReportQueryDto,
  ): Promise<PerformanceReportResponse> {
    // The subject is always the verified session, never a request parameter.
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) throw new UnauthorizedException('Missing authenticated user');
    return this.performanceReportService.getReport(userId, query.period);
  }
}
