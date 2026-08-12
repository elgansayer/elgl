import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Response } from 'express';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return metrics with proper content type', async () => {
    const mockResponse = {
      set: vi.fn(),
      send: vi.fn(),
    };

    await controller.getMetrics(mockResponse as unknown as Response);

    expect(mockResponse.set).toHaveBeenCalledWith(
      'Content-Type',
      metricsService.getContentType(),
    );
    expect(mockResponse.send).toHaveBeenCalled();
    const sentMetrics = mockResponse.send.mock.calls[0][0];
    expect(sentMetrics).toContain('hellotalk_');
  });
});
