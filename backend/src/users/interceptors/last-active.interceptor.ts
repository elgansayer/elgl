import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastActiveInterceptor.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request: any = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId: string | undefined = request.user?.id;

    if (userId) {
      // Fire and forget - don't block the response
      this.updateLastActive(userId).catch((err: unknown) =>
        this.logger.error(
          `Failed to update last_active_at: ${(err as Error).message}`,
        ),
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
      this.logger.warn(
        `Failed to update last_active_at for user ${userId}: ${error.message}`,
      );
    }
  }
}
