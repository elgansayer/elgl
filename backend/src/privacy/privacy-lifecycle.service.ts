import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AccountDeletionStatus {
  pending: boolean;
  scheduled_for: string | null;
  requested_at: string | null;
}

@Injectable()
export class PrivacyLifecycleService {
  private readonly logger = new Logger(PrivacyLifecycleService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getAccountDeletionStatus(
    userId: string,
  ): Promise<AccountDeletionStatus> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select(
        'is_deletion_pending, scheduled_for_deletion_at, deletion_requested_at',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      this.logger.warn('privacy_deletion_status_unavailable');
      throw new ServiceUnavailableException(
        'Account deletion status is temporarily unavailable.',
      );
    }

    const pending = data.is_deletion_pending === true;

    return {
      pending,
      scheduled_for: pending
        ? this.normaliseTimestamp(data.scheduled_for_deletion_at)
        : null,
      requested_at: pending
        ? this.normaliseTimestamp(data.deletion_requested_at)
        : null,
    };
  }

  private normaliseTimestamp(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp)
      ? new Date(timestamp).toISOString()
      : null;
  }
}
