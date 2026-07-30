import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

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

  getCallLogs(
    userId: string,
    options?: { callType?: string; limit?: number; offset?: number },
  ): Observable<CallLogRecord[]> {
    let query = this.supabase
      .getClient()
      .from('call_logs')
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

    return from(query).pipe(
      map(({ data }): CallLogRecord[] => {
        const arr = data ?? [];
        return Array.isArray(arr) ? arr : [];
      }),
    );
  }
}
