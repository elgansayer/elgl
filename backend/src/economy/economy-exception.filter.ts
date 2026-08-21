import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';

interface EconomyErrorContext {
  userId?: string;
  path: string;
  method: string;
  timestamp: string;
  statusCode: number;
  errorCode: string;
  userAgent?: string;
  ip?: string;
}

@Catch()
export class EconomyExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(EconomyExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred in the coin economy system';
    let errorCode = 'ECONOMY_INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : typeof exceptionResponse === 'object' &&
              exceptionResponse !== null &&
              'message' in exceptionResponse
            ? String(
                Array.isArray(exceptionResponse.message)
                  ? exceptionResponse.message.join('; ')
                  : exceptionResponse.message,
              )
            : exception.message;

      if (statusCode >= 500) {
        errorCode = 'ECONOMY_INTERNAL_ERROR';
      } else if (statusCode === HttpStatus.BAD_REQUEST) {
        errorCode = 'ECONOMY_BAD_REQUEST';
      } else if (statusCode === HttpStatus.NOT_FOUND) {
        errorCode = 'ECONOMY_NOT_FOUND';
      } else if (statusCode === HttpStatus.CONFLICT) {
        errorCode = 'ECONOMY_CONFLICT';
      } else if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
        errorCode = 'ECONOMY_RATE_LIMITED';
      } else if (statusCode === HttpStatus.FORBIDDEN) {
        errorCode = 'ECONOMY_FORBIDDEN';
      } else if (statusCode === HttpStatus.UNAUTHORIZED) {
        errorCode = 'ECONOMY_UNAUTHORISED';
      } else {
        errorCode = 'ECONOMY_HTTP_ERROR';
      }
    }

    const requestedUser = request.headers?.['x-user-id'] as string | undefined;

    const errorContext: EconomyErrorContext = {
      userId: requestedUser ?? undefined,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      statusCode,
      errorCode,
      userAgent: request.headers?.['user-agent'],
      ip: request.ip ?? request.socket?.remoteAddress,
    };

    if (statusCode >= 500) {
      this.logger.error({
        msg: `Economy crash: ${message}`,
        ...errorContext,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else if (statusCode >= 400) {
      this.logger.warn({
        msg: `Economy client error: ${message}`,
        ...errorContext,
      });
    } else {
      this.logger.info({
        msg: `Economy exception: ${message}`,
        ...errorContext,
      });
    }

    response.status(statusCode).json({
      statusCode,
      errorCode,
      message,
      timestamp: errorContext.timestamp,
    });
  }
}
