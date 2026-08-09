import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${environment.apiUrl}/audio-rooms`;

  async getCallLogs(options?: { callType?: string; limit?: number; offset?: number }): Promise<CallLogRecord[]> {
    let params = new HttpParams()
      .set('limit', String(options?.limit ?? 20))
      .set('offset', String(options?.offset ?? 0));
    if (options?.callType) {
      params = params.set('callType', options.callType);
    }

    return firstValueFrom(
      this.http.get<CallLogRecord[]>(`${this.baseUrl}/call-logs`, { params }),
    );
  }
}
