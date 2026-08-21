import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      route?: { path?: string };
    }>();
    const startTime = Date.now();
    const method = request.method;
    const route = request.route?.path ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{
            statusCode: number;
          }>();
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.recordHttpRequest(
            method,
            route,
            response.statusCode,
            duration,
          );
        },
        error: () => {
          const response = context.switchToHttp().getResponse<{
            statusCode: number;
          }>();
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.recordHttpRequest(
            method,
            route,
            response.statusCode || 500,
            duration,
          );
        },
      }),
    );
  }
}
