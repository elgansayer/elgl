import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { EconomyExceptionFilter } from './economy-exception.filter';

describe('EconomyExceptionFilter', () => {
  let filter: EconomyExceptionFilter;
  let mockLogger: { error: Mock; warn: Mock; info: Mock };

  beforeEach(async () => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EconomyExceptionFilter,
        {
          provide: 'PinoLogger:EconomyExceptionFilter',
          useValue: mockLogger,
        },
      ],
    }).compile();

    filter = module.get<EconomyExceptionFilter>(EconomyExceptionFilter);
  });

  function createArgumentsHost(
    url: string,
    method: string,
    headers?: Record<string, string>,
  ): ArgumentsHost {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    return {
      switchToHttp: () => ({
        getResponse: () => ({
          status: statusMock,
        }),
        getRequest: () => ({
          url,
          method,
          headers: headers ?? {},
          ip: '127.0.0.1',
        }),
      }),
    } as unknown as ArgumentsHost;
  }

  it('should handle HttpException with 400 status', () => {
    const exception = new HttpException(
      'Bad coin request',
      HttpStatus.BAD_REQUEST,
    );
    const host = createArgumentsHost('/api/economy/purchase-coins', 'POST');

    filter.catch(exception, host);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('Bad coin request'),
        statusCode: 400,
        errorCode: 'ECONOMY_BAD_REQUEST',
      }),
    );
  });

  it('should handle HttpException with 500 status', () => {
    const exception = new HttpException(
      'Internal coin crash',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const host = createArgumentsHost('/api/economy/send-gift', 'POST');

    filter.catch(exception, host);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('Internal coin crash'),
        statusCode: 500,
        errorCode: 'ECONOMY_INTERNAL_ERROR',
      }),
    );
  });

  it('should handle non-HttpException as 500', () => {
    const exception = new Error('Unexpected runtime crash');
    const host = createArgumentsHost('/api/economy/balance', 'GET');

    filter.catch(exception, host);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('An unexpected error occurred'),
        statusCode: 500,
        errorCode: 'ECONOMY_INTERNAL_ERROR',
      }),
    );
  });

  it('should include x-user-id header in context when present', () => {
    const exception = new HttpException(
      'Forbidden coin operation',
      HttpStatus.FORBIDDEN,
    );
    const host = createArgumentsHost(
      '/api/economy/unlock-sticker-pack',
      'POST',
      {
        'x-user-id': 'user-abc-123',
        'user-agent': 'HelloTalk/1.0',
      },
    );

    filter.catch(exception, host);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('Forbidden coin operation'),
        userId: 'user-abc-123',
        errorCode: 'ECONOMY_FORBIDDEN',
        statusCode: 403,
      }),
    );
  });

  it('should return structured JSON response', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({
          url: '/api/economy/sticker-packs',
          method: 'GET',
          headers: {},
          ip: '::1',
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        errorCode: 'ECONOMY_NOT_FOUND',
        message: 'Not found',
        timestamp: expect.any(String) as unknown,
      }),
    );
  });
});
