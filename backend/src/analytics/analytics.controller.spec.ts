import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockAnalyticsService: { recordClientError: Mock };

  beforeEach(async () => {
    mockAnalyticsService = {
      recordClientError: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('logClientError', () => {
    it('calls analyticsService.recordClientError with DTO and returns status', async () => {
      const dto = {
        message: 'Test crash',
        name: 'Error',
        url: 'https://example.com',
      };

      const result = await controller.logClientError(dto);

      expect(mockAnalyticsService.recordClientError).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ status: 'logged' });
    });
  });
});
