import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';

@Catch()
export class MatchmakingExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly crashReportService: MatchmakingCrashReportService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const user = (request as unknown as Record<string, unknown>).user as
      { id: string } | undefined;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpExceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const message =
      typeof httpExceptionResponse === 'object' &&
      httpExceptionResponse !== null &&
      'message' in httpExceptionResponse
        ? (httpExceptionResponse as Record<string, unknown>).message
        : exception.message;

    // Report every non-4xx or non-HttpException as a crash
    if (status >= 500 || !(exception instanceof HttpException)) {
      const circuitOpen = this.circuitBreakerService.isAvailable('matchmaking')
        ? false
        : true;

      await this.crashReportService.reportCrash({
        operation: `${request.method} ${request.path}`,
        user_id: user?.id,
        error_type: exception.constructor.name,
        error_message: exception.message,
        stack_trace: exception.stack,
        context: {
          status_code: status,
          request_params: request.params,
        },
        circuit_breaker_open: circuitOpen,
      });
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message)
        ? (message as string[]).join('; ')
        : String(message),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
