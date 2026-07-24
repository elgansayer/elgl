import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (userId) {
      // Fire and forget - don't block the response
      this.updateLastActive(userId).catch((err) =>
        this.logger.error(`Failed to update last_active_at: ${err.message}`),
      );
    }

    return next.handle();
  }

  private async updateLastActive(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({ last_active_at: now })
      .eq('id', userId);

    if (error) {
      this.logger.warn(`Failed to update last_active_at for user ${userId}: ${error.message}`);
    }
  }
}
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (userId) {
      // Fire and forget - don't block the response
      this.updateLastActive(userId).catch((err) =>
        this.logger.error(`Failed to update last_active_at: ${err.message}`),
      );
    }

    return next.handle();
  }

  private async updateLastActive(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({ last_active_at: now })
      .eq('id', userId);

    if (error) {
      this.logger.warn(`Failed to update last_active_at for user ${userId}: ${error.message}`);
    }
  }
}
