import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AnalyticsService } from '../../analytics/analytics.service';
import { EscrowBaseException } from '../exceptions/escrow.exceptions';

/**
 * Exception filter for escrow payment operations.
 * Catches all EscrowBaseException subtypes, reports them to the crash reporting
 * pipeline (AnalyticsService), and returns a structured error response.
 * Non-escrow exceptions are also caught and wrapped with crash reporting.
 *
 * Registered via APP_FILTER in EscrowPaymentsModule.
 */
@Catch()
export class EscrowExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EscrowExceptionFilter.name);

  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof EscrowBaseException) {
      const errorResponse = exception.getResponse();
      const status = exception.getStatus();

      void this.reportEscrowError(exception, request);

      response.status(status).json({
        ...(typeof errorResponse === 'object'
          ? { ...errorResponse }
          : { message: errorResponse }),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    } else {
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const stack =
        exception instanceof Error ? exception.stack : undefined;

      this.logger.error(`Unhandled escrow error: ${message}`, stack);

      void this.reportUnexpectedError(request, message, stack, exception);

      response.status(500).json({
        statusCode: 500,
        errorCode: 'ESCROW_INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the escrow payment',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async reportEscrowError(
    exception: EscrowBaseException,
    request: Request,
  ): Promise<void> {
    try {
      const details = exception.toErrorDetails();
      await this.analyticsService.recordClientError({
        message: `[Escrow] ${details.message}`,
        name: `EscrowException:${details.code}`,
        stack: details.stack,
        url: request.url,
        userAgent: request.headers['user-agent'] as string,
        metadata: {
          escrowErrorCode: details.code,
          escrowContext: details.context,
          isRecoverable: details.isRecoverable,
          httpMethod: request.method,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (reportErr: unknown) {
      this.logger.error(
        `Failed to report escrow error: ${(reportErr as Error).message}`,
      );
    }
  }

  private async reportUnexpectedError(
    request: Request,
    message: string,
    stack?: string,
    raw?: unknown,
  ): Promise<void> {
    try {
      await this.analyticsService.recordClientError({
        message: `[Escrow:Unexpected] ${message}`,
        name: 'EscrowUnexpectedError',
        stack,
        url: request.url,
        userAgent: request.headers['user-agent'] as string,
        metadata: {
          httpMethod: request.method,
          rawType: typeof raw,
          isEscrowContext: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Best-effort reporting
    }
  }
}