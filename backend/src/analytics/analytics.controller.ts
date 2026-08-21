import { Controller, Post, Body } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ClientErrorDto } from './dto/client-error.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('client-error')
  async logClientError(
    @Body() dto: ClientErrorDto,
  ): Promise<{ status: string }> {
    await this.analyticsService.recordClientError(dto);
    return { status: 'logged' };
  }
}
