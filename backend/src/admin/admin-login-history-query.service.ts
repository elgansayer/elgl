import { Injectable } from '@nestjs/common';
import { DataScrubbingService } from '../privacy/data-scrubbing.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginHistoryEntry } from './interfaces/admin-user.interface';

@Injectable()
export class AdminLoginHistoryQueryService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly scrubbingService: DataScrubbingService,
  ) {}

  async list(userId: string): Promise<LoginHistoryEntry[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('login_history')
      .select('id, user_id, ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const result = (data ?? []) as LoginHistoryEntry[];
    this.scrubbingService.scrubLoginHistory(result);
    return result;
  }
}
