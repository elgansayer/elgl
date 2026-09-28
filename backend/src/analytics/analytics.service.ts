import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ClientErrorDto } from './dto/client-error.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async recordClientError(payload: ClientErrorDto): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase.from('client_errors').insert({
        message: payload.message,
        name: payload.name ?? 'Error',
        stack: payload.stack ?? null,
        component_stack: payload.componentStack ?? null,
        url: payload.url ?? null,
        user_agent: payload.userAgent ?? null,
        metadata: payload.metadata ?? null,
        stack_frames: payload.stackFrames ?? null,
        client_timestamp: payload.timestamp ?? new Date().toISOString(),
      } as never);

      if (error) {
        this.logger.warn(`Failed to log client error: ${error.message}`);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Exception while recording client error: ${(err as Error).message}`,
      );
    }
  }
}
