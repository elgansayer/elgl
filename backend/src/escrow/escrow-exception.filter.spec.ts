import type { Mock } from 'vitest';
import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EscrowExceptionFilter } from './escrow-exception.filter';
import { CrashReportService } from './crash-report.service';

describe('EscrowExceptionFilter', () => {
  let filter: EscrowExceptionFilter;
  let crashReportService: CrashReportService;

  let mockResponse: { status: Mock; json: Mock };
  let mockRequest: {
    method: string;
    path: string;
    url: string;
    body: Record<string, unknown>;
    params: Record<string, unknown>;
    user?: { id: string } | undefined;
  };
  let mockHost: { switchToHttp: Mock };

  beforeEach(() => {
    crashReportService = {
      reportCrash: vi.fn().mockResolvedValue(null),
    } as unknown as CrashReportService;

    filter = new EscrowExceptionFilter(crashReportService);

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      path: '/api/escrow/create',
      url: '/api/escrow/create',
      body: {
        partner_id: 'partner-1',
        amount: 100,
        description: 'Test',
      },
      params: {},
      user: { id: 'user-1' },
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle HttpException (4xx) without crash report', async () => {
    const exception = new BadRequestException('Insufficient balance');

    await filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Insufficient balance',
      }),
    );
    // 4xx errors should NOT trigger a crash report
    expect(crashReportService.reportCrash).not.toHaveBeenCalled();
  });

  it('should handle HttpException (5xx) with crash report', async () => {
    const exception = new InternalServerErrorException('DB failure');

    await filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'DB failure',
      }),
    );
    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'POST /api/escrow/create',
        user_id: 'user-1',
        error_type: 'InternalServerErrorException',
        error_message: 'DB failure',
        context: expect.objectContaining({
          status_code: 500,
        }),
      }),
    );
  });

  it('should handle non-HttpException with crash report', async () => {
    const exception = new Error('Unexpected runtime error');

    await filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Unexpected runtime error',
      }),
    );
    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Unexpected runtime error',
      }),
    );
  });

  it('should extract escrow_id from request body', async () => {
    mockRequest.body = { escrow_id: 'escrow-123', reason: 'Test' };
    mockRequest.path = '/api/escrow/refund';
    const exception = new InternalServerErrorException('Refund failed');

    await filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        escrow_id: 'escrow-123',
      }),
    );
  });

  it('should extract escrow_id from request params', async () => {
    mockRequest.body = {};
    mockRequest.params = { id: 'escrow-456' };
    mockRequest.path = '/api/escrow/escrow-456';
    const exception = new NotFoundException('Not found');

    await filter.catch(exception, mockHost);

    // 404 is a 4xx so no crash report
    expect(mockResponse.status).toHaveBeenCalledWith(404);
  });

  it('should handle array messages from class-validator', async () => {
    const exception = new BadRequestException([
      'amount must be a positive number',
      'partner_id must be a UUID',
    ]);

    await filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'amount must be a positive number; partner_id must be a UUID',
      }),
    );
  });

  it('should work without a user on the request', async () => {
    mockRequest.user = undefined;
    const exception = new InternalServerErrorException('System error');

    await filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: undefined,
      }),
    );
  });

  it('should include stack_trace in crash report', async () => {
    const exception = new Error('Runtime error');
    exception.stack = 'Error: Runtime error\n    at test.js:1:1';

    await filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        stack_trace: 'Error: Runtime error\n    at test.js:1:1',
      }),
    );
  });
});
