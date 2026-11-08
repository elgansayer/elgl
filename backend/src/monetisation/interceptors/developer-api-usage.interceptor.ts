import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Records usage for requests authenticated with a Developer Tier API key.
 *
 * Session-authenticated dashboard traffic is ignored so local dashboard
 * browsing does not inflate the developer's programmatic API statistics.
 */
@Injectable()
export class DeveloperApiUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DeveloperApiUsageInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!request.developerApiKeyAuthenticated || !userId) {
      return next.handle();
    }

    const startedAt = Date.now();
    return next.handle().pipe(
      finalize(() => {
        const latencyMs = Math.max(Date.now() - startedAt, 0);
        void this.recordUsage(userId, latencyMs);
      }),
    );
  }

  private async recordUsage(userId: string, latencyMs: number): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .rpc('record_developer_api_usage', {
          p_user_id: userId,
          p_latency_ms: latencyMs,
        });
      if (error) {
        this.logger.warn(
          `Failed to record developer API usage for ${userId}: ${error.message}`,
        );
      }
    } catch {
      this.logger.warn(
        `Developer API usage recording unavailable for ${userId}`,
      );
    }
  }
}
