import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';

/**
 * Exception filter applied to all reading-engine endpoints.
 * Catches every exception, reports crashes through ReadingEngineCrashReportService,
 * and returns a structured JSON error response.
 */
@Catch()
export class ReadingEngineExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly crashReportService: ReadingEngineCrashReportService,
  ) {}

  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const user = (request as Record<string, unknown>).user as
      | { id: string }
      | undefined;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpExceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : undefined;

    const message =
      typeof httpExceptionResponse === 'object' &&
      httpExceptionResponse !== null &&
      'message' in httpExceptionResponse
        ? (httpExceptionResponse as Record<string, unknown>).message
        : exception.message;

    // Extract resource_id from request params or body
    const body = request.body as Record<string, unknown> | undefined;
    const params = request.params as Record<string, string> | undefined;
    const resourceId =
      (body?.resourceId as string) ||
      (body?.resource_id as string) ||
      params?.id ||
      undefined;

    // Report every non-4xx exception as a crash
    if (status >= 500 || !(exception instanceof HttpException)) {
      await this.crashReportService.reportCrash({
        operation: `${request.method} ${request.path}`,
        user_id: user?.id,
        resource_id: resourceId,
        error_type: exception.constructor.name,
        error_message: exception.message,
        stack_trace: exception.stack,
        context: {
          status_code: status,
          request_body: body,
          request_params: params,
        },
      });
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message)
        ? (message as string[]).join('; ')
        : String(message),
      timestamp: new Date().toISOString(),
      path: request.url,
      resource_id: resourceId,
    });
  }
}