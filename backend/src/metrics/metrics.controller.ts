<<<<<<< HEAD
import { Controller, Get, Res } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Response } from 'express';

=======
import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
>>>>>>> origin/main
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
<<<<<<< HEAD
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.getContentType());
=======
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics(@Res() res: Response): Promise<void> {
>>>>>>> origin/main
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
