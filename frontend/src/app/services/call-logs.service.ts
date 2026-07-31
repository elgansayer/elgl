import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CallLogRecord {
  id: string;
  caller_id: string;
  caller_name: string;
  receiver_id: string;
  receiver_name: string;
  call_type: 'incoming' | 'outgoing' | 'missed';
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class CallLogsService {
  private supabase = inject(SupabaseService);

  async getCallLogs(options?: { callType?: string; limit?: number; offset?: number }): Promise<CallLogRecord[]> {
    const supabase = this.supabase.getClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) return [];

    let query = supabase
      .from<CallLogRecord>('call_logs')
      .select('*')
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('started_at', { ascending: false })
      .range(
        options?.offset ?? 0,
        (options?.offset ?? 0) + (options?.limit ?? 20) - 1,
      );

    if (options?.callType) {
      query = query.eq('call_type', options.callType);
    }

    const { data } = await query;
    return data ?? [];
  }
}
