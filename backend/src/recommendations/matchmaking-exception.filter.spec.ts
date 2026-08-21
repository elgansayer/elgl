import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';

describe('MatchmakingExceptionFilter', () => {
  let filter: MatchmakingExceptionFilter;
  let mockCrashReportService: { reportCrash: Mock };
  let mockCircuitBreakerService: { isAvailable: Mock };

  beforeEach(async () => {
    mockCrashReportService = {
      reportCrash: vi.fn().mockResolvedValue({}),
    };

    mockCircuitBreakerService = {
      isAvailable: vi.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingExceptionFilter,
        {
          provide: MatchmakingCrashReportService,
          useValue: mockCrashReportService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
      ],
    }).compile();

    filter = module.get<MatchmakingExceptionFilter>(MatchmakingExceptionFilter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  function mockRequestContext(
    user?: { id: string },
    body?: Record<string, unknown>,
  ) {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const req = {
      method: 'GET',
      url: '/recommendations/for-you',
      path: '/recommendations/for-you',
      params: {} as Record<string, unknown>,
      user,
      body: body ?? {},
    };

    return {
      req,
      res: {
        status,
        json,
      } as unknown as import('express').Response,
      host: {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => ({ status, json }),
        }),
      },
    };
  }

  describe('catch - 5xx errors', () => {
    it('should report crash and return 500 for non-Http exceptions', async () => {
      const { host, res } = mockRequestContext({ id: 'user-1' });
      const error = new Error('Unexpected failure');

      await filter.catch(error, host as never);

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'GET /recommendations/for-you',
          user_id: 'user-1',
          error_type: 'Error',
          error_message: 'Unexpected failure',
          circuit_breaker_open: false,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should report crash for 500 HttpException', async () => {
      const { host, res } = mockRequestContext({ id: 'user-2' });
      const error = new HttpException(
        'Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      await filter.catch(error, host as never);

      expect(mockCrashReportService.reportCrash).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should mark circuit_breaker_open when breaker is open', async () => {
      mockCircuitBreakerService.isAvailable.mockReturnValue(false);
      const { host } = mockRequestContext({ id: 'user-3' });
      const error = new Error('Service unavailable');

      await filter.catch(error, host as never);

      expect(mockCrashReportService.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({ circuit_breaker_open: true }),
      );
    });
  });

  describe('catch - 4xx errors', () => {
    it('should NOT report crash for 4xx HttpExceptions', async () => {
      const { host, res } = mockRequestContext({ id: 'user-4' });
      const error = new HttpException('Not found', HttpStatus.NOT_FOUND);

      await filter.catch(error, host as never);

      expect(mockCrashReportService.reportCrash).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should NOT report crash for 400 Bad Request', async () => {
      const { host, res } = mockRequestContext({ id: 'user-5' });
      const responseBody = {
        message: ['Validation failed'],
      };
      const error = new HttpException(responseBody, HttpStatus.BAD_REQUEST);

      await filter.catch(error, host as never);

      expect(mockCrashReportService.reportCrash).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });
});
