import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { ClientErrorDto } from './dto/client-error.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('client-error')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async logClientError(
    @Body() dto: ClientErrorDto,
  ): Promise<{ status: string }> {
    await this.analyticsService.recordClientError(dto);
    return { status: 'logged' };
  }
}
