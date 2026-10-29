import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { LogClientErrorDto } from './dto/client-error.dto';

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

    it('preserves stack traces with <anonymous> and generic types in LogClientErrorDto', async () => {
      const dto: LogClientErrorDto = {
        message: 'TypeError: render<List<T>>() failed',
        name: 'TypeError',
        stack:
          'TypeError: render<List<T>>()\n    at <anonymous> (app.component.ts:42:10)',
        componentStack: '<AppComponent>\n    at <anonymous>',
        stackFrames: [
          {
            functionName: '<anonymous>',
            fileName: 'app.component.ts',
            source: 'render<List<T>>()',
            lineNumber: 42,
            columnNumber: 10,
          },
        ],
      };

      const result = await controller.logClientError(dto);

      expect(mockAnalyticsService.recordClientError).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ status: 'logged' });
    });
  });
});
