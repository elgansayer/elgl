import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: User;
}

// A request is treated as the start of a new session (and recorded in
// login_history for the admin portal) once this many milliseconds have
// passed since the user's last recorded activity.
const SESSION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (userId) {
      // Fire and forget - don't block the response
      const ipAddress = this.firstHeaderValue(
        request.ip ?? request.headers['x-forwarded-for'],
      );
      const userAgent = this.firstHeaderValue(request.headers['user-agent']);

      this.updateLastActive(userId, ipAddress, userAgent).catch(
        (err: unknown) =>
          this.logger.error(
            `Failed to update last_active_at: ${(err as Error).message}`,
          ),
      );
    }

    return next.handle();
  }

  private firstHeaderValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private async updateLastActive(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('users')
      .select('last_active_at')
      .eq('id', userId)
      .single();

    const { error } = await supabase
      .from('users')
      .update({ last_active_at: now })
      .eq('id', userId);

    if (error) {
      this.logger.warn(
        `Failed to update last_active_at for user ${userId}: ${error.message}`,
      );
    }

    const previousActiveAt = existing?.last_active_at as string | undefined;
    const isNewSession =
      !previousActiveAt ||
      Date.now() - new Date(previousActiveAt).getTime() > SESSION_GAP_MS;

    if (isNewSession) {
      const { error: loginHistoryError } = await supabase
        .from('login_history')
        .insert({
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
        } as never);

      if (loginHistoryError) {
        this.logger.warn(
          `Failed to record login history for user ${userId}: ${loginHistoryError.message}`,
        );
      }
    }
  }
}
