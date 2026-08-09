import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
        ? (message as Record<string, unknown>).message ?? JSON.stringify(message)
        : String(message);

    const errorName =
      exception instanceof Error ? exception.name : 'UnknownError';

    const logPayload: ReadingEngineErrorLog = {
      message: String(extractedMessage),
      name: errorName,
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      resourceId: request.params?.id ?? undefined,
    };

    this.logger.error(
      `[ReadingEngine] ${request.method} ${request.url} → ${status} (${errorName}): ${extractedMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message: extractedMessage,
      timestamp: logPayload.timestamp,
      path: request.url,
    });
  }
}