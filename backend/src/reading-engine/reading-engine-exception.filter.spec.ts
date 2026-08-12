import type { Mock } from 'vitest';
import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ReadingEngineExceptionFilter } from './reading-engine-exception.filter';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';

describe('ReadingEngineExceptionFilter', () => {
  let filter: ReadingEngineExceptionFilter;
  let crashReportService: ReadingEngineCrashReportService;

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
    } as unknown as ReadingEngineCrashReportService;

    filter = new ReadingEngineExceptionFilter(crashReportService);

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      path: '/reading/resources',
      url: '/reading/resources',
      body: {
        title: 'Test article',
        content: 'Sample content',
        language: 'en-GB',
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

  it('should handle HttpException (4xx) without crash report', () => {
    const exception = new BadRequestException('Invalid resource data');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Invalid resource data',
      }),
    );
    // 4xx errors should NOT trigger a crash report
    expect(crashReportService.reportCrash).not.toHaveBeenCalled();
  });

  it('should handle HttpException (5xx) with crash report', () => {
    const exception = new InternalServerErrorException('Database query failed');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Database query failed',
      }),
    );
    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'POST /reading/resources',
        user_id: 'user-1',
        error_type: 'InternalServerErrorException',
        error_message: 'Database query failed',
        context: expect.objectContaining({
          status_code: 500,
        }),
      }),
    );
  });

  it('should handle non-HttpException with crash report', () => {
    const exception = new Error('Unexpected runtime error in reading engine');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Unexpected runtime error in reading engine',
      }),
    );
    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Unexpected runtime error in reading engine',
      }),
    );
  });

  it('should extract resource_id from request body', () => {
    mockRequest.body = { resourceId: 'res-123', title: 'Updated title' };
    mockRequest.path = '/reading/resources/res-123';
    const exception = new InternalServerErrorException('Update failed');

    filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_id: 'res-123',
      }),
    );
  });

  it('should extract resource_id from request params when not in body', () => {
    mockRequest.body = {};
    mockRequest.params = { id: 'res-456' };
    mockRequest.url = '/reading/resources/res-456';
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost);

    // 404 is 4xx, no crash report
    expect(mockResponse.status).toHaveBeenCalledWith(404);
  });

  it('should handle array messages from class-validator', () => {
    const exception = new BadRequestException([
      'title must be a string',
      'content must not be empty',
    ]);

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'title must be a string; content must not be empty',
      }),
    );
  });

  it('should work without a user on the request', () => {
    mockRequest.user = undefined;
    const exception = new InternalServerErrorException('Cache failure');

    filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: undefined,
      }),
    );
  });

  it('should include stack_trace in crash report', () => {
    const exception = new Error('Tokenisation error');
    exception.stack =
      'Error: Tokenisation error\n    at reading-engine.service.ts:150:20';

    filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        stack_trace:
          'Error: Tokenisation error\n    at reading-engine.service.ts:150:20',
      }),
    );
  });

  it('should handle GET requests with resource id in params', () => {
    mockRequest.method = 'GET';
    mockRequest.path = '/reading/resources/res-789';
    mockRequest.url = '/reading/resources/res-789';
    mockRequest.body = {};
    mockRequest.params = { id: 'res-789' };
    const exception = new InternalServerErrorException('Cache miss');

    filter.catch(exception, mockHost);

    expect(crashReportService.reportCrash).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_id: 'res-789',
        operation: 'GET /reading/resources/res-789',
      }),
    );
  });

  it('should include resource_id in response body', () => {
    mockRequest.params = { id: 'res-abc' };
    const exception = new InternalServerErrorException('Processing error');

    filter.catch(exception, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_id: 'res-abc',
      }),
    );
  });
});
