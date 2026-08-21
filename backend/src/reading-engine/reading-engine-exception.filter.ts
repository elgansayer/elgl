import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';

interface ReadingEngineErrorLog {
  message: string;
  name: string;
  statusCode: number;
  path: string;
  method: string;
  timestamp: string;
  routePattern?: string;
  resourceId?: string;
}

/**
 * Exception filter that intercepts unhandled exceptions in the reading-engine
 * controller, normalises the response, and emits structured crash reports
 * that can be ingested by Datadog / Prometheus.
 */
@Catch()
export class ReadingEngineExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ReadingEngineExceptionFilter.name);

  constructor(
    private readonly crashReportService: ReadingEngineCrashReportService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const extractedMessage =
      typeof message === 'object' && message !== null
        ? ((message as Record<string, unknown>).message ??
          JSON.stringify(message))
        : String(message);
    const normalisedMessage = Array.isArray(extractedMessage)
      ? extractedMessage.join('; ')
      : String(extractedMessage);

    const errorName =
      exception instanceof Error ? exception.name : 'UnknownError';

    const logPayload: ReadingEngineErrorLog = {
      message: normalisedMessage,
      name: errorName,
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      resourceId:
        typeof request.params?.id === 'string' ? request.params.id : undefined,
    };

    if (status >= 500) {
      void this.crashReportService.reportCrash({
        operation: `${request.method} ${request.url}`,
        user_id: (request as Request & { user?: { id: string } }).user?.id,
        resource_id:
          typeof request.params?.id === 'string'
            ? request.params.id
            : typeof request.body?.resourceId === 'string'
              ? request.body.resourceId
              : undefined,
        error_type: errorName,
        error_message: normalisedMessage,
        stack_trace: exception instanceof Error ? exception.stack : undefined,
        context: { status_code: status },
      });
    }

    this.logger.error(
      `[ReadingEngine] ${request.method} ${request.url} → ${status} (${errorName}): ${normalisedMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message: normalisedMessage,
      timestamp: logPayload.timestamp,
      path: request.url,
      ...(request.params?.id || request.body?.resourceId
        ? { resource_id: request.params?.id ?? request.body.resourceId }
        : {}),
    });
  }
}
