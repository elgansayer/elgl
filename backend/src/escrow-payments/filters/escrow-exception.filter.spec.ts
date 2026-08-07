import { EscrowExceptionFilter } from './escrow-exception.filter';
import { AnalyticsService } from '../../analytics/analytics.service';
import {
  EscrowNotFoundException,
  EscrowInvalidStateException,
} from '../exceptions/escrow.exceptions';
import { ArgumentsHost } from '@nestjs/common';

describe('EscrowExceptionFilter', () => {
  let filter: EscrowExceptionFilter;
  let mockAnalyticsService: { recordClientError: jest.Mock };
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockResponse: { status: jest.Mock };
  let mockRequest: { url: string; method: string; headers: Record<string, string> };
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    mockAnalyticsService = {
      recordClientError: jest.fn().mockResolvedValue(undefined),
    };

    filter = new EscrowExceptionFilter(mockAnalyticsService as unknown as AnalyticsService);

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockResponse = { status: mockStatus };
    mockRequest = {
      url: '/api/escrow-payments/test',
      method: 'POST',
      headers: { 'user-agent': 'Jest/29' },
    };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: <T>() => mockResponse as T,
        getRequest: <T>() => mockRequest as T,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('catches EscrowNotFoundException and returns structured error with crash report', async () => {
    const exception = new EscrowNotFoundException('escrow-123');

    filter.catch(exception, mockArgumentsHost);

    // Wait for async report to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'ESCROW_NOT_FOUND',
        message: expect.stringContaining('escrow-123'),
        path: '/api/escrow-payments/test',
        timestamp: expect.any(String),
      }),
    );

    expect(mockAnalyticsService.recordClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('[Escrow]'),
        name: expect.stringContaining('EscrowException:ESCROW_NOT_FOUND'),
        url: '/api/escrow-payments/test',
        metadata: expect.objectContaining({
          escrowErrorCode: 'ESCROW_NOT_FOUND',
          isRecoverable: false,
          httpMethod: 'POST',
        }),
      }),
    );
  });

  it('catches EscrowInvalidStateException with recoverable=true', async () => {
    const exception = new EscrowInvalidStateException('escrow-1', 'disputed', ['funds_held']);

    filter.catch(exception, mockArgumentsHost);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStatus).toHaveBeenCalledWith(409);
    expect(mockAnalyticsService.recordClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          escrowErrorCode: 'INVALID_STATE',
          isRecoverable: true,
          escrowContext: expect.objectContaining({
            escrowId: 'escrow-1',
            currentState: 'disputed',
          }),
        }),
      }),
    );
  });

  it('catches unexpected (non-Escrow) errors and returns 500', async () => {
    const genericError = new Error('Something completely unexpected happened');

    filter.catch(genericError, mockArgumentsHost);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        errorCode: 'ESCROW_INTERNAL_ERROR',
        message: expect.stringContaining('unexpected error'),
      }),
    );

    expect(mockAnalyticsService.recordClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'EscrowUnexpectedError',
        message: expect.stringContaining('[Escrow:Unexpected] Something completely unexpected'),
        metadata: expect.objectContaining({
          isEscrowContext: true,
          httpMethod: 'POST',
        }),
      }),
    );
  });

  it('handles analytics service failure gracefully', async () => {
    mockAnalyticsService.recordClientError.mockRejectedValue(
      new Error('Analytics down'),
    );
    const exception = new EscrowNotFoundException('esc-456');

    // Should not throw
    expect(() => filter.catch(exception, mockArgumentsHost)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('includes statusCode in error response for extractable numbers', async () => {
    const exception = new EscrowNotFoundException('test');

    filter.catch(exception, mockArgumentsHost);
    await new Promise((r) => setTimeout(r, 10));

    const jsonCall = mockJson.mock.calls[0][0];
    expect(jsonCall.statusCode).toBe(404);
    expect(jsonCall.errorCode).toBe('ESCROW_NOT_FOUND');
  });
});