import { Controller, Get, Param } from '@nestjs/common';
import { HostDashboardService } from './host-dashboard.service';
import { HostDashboardStatsDto } from './dto/host-dashboard.dto';

@Controller('host-dashboard')
export class HostDashboardController {
  constructor(private readonly service: HostDashboardService) {}

  @Get(':roomId/stats')
  async getStats(
    @Param('roomId') roomId: string,
  ): Promise<HostDashboardStatsDto> {
    return this.service.getStats(roomId);
  }
}
