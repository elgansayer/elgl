import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CrashReportService } from './crash-report.service';

/**
 * Exception filter applied to all escrow endpoints.
 * Catches every exception, reports crashes through CrashReportService,
 * and returns a structured JSON error response.
 */
@Catch()
export class EscrowExceptionFilter implements ExceptionFilter {
  constructor(private readonly crashReportService: CrashReportService) {}

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

    // Extract escrow_id from request body, params, or query
    const body = request.body as Record<string, unknown> | undefined;
    const params = request.params as Record<string, string> | undefined;
    const escrowId =
      (body?.escrow_id as string) ||
      params?.id ||
      params?.escrow_id ||
      undefined;

    // Report every non-4xx exception as a crash
    if (status >= 500 || !(exception instanceof HttpException)) {
      await this.crashReportService.reportCrash({
        operation: `${request.method} ${request.path}`,
        escrow_id: escrowId,
        user_id: user?.id,
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
      escrow_id: escrowId,
    });
  }
}
