import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type AudioRoomSummaryStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface AudioRoomArchiveListItem {
  id: string;
  title: string;
  language_pair: string | null;
  topic_tag: string | null;
  host_id: string;
  is_private: boolean;
  recording_url: string | null;
  created_at: string;
  summary_status: AudioRoomSummaryStatus | null;
}

export interface AudioRoomArchiveSummary {
  room_id: string;
  recording_url: string | null;
  transcript_text: string | null;
  session_summary: string | null;
  vocabulary: string[];
  summary_status: AudioRoomSummaryStatus;
  summary_attempts: number;
  can_retry: boolean;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AudioRoomArchivesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/audio-room-archives`;

  list(): Promise<AudioRoomArchiveListItem[]> {
    return firstValueFrom(
      this.http.get<AudioRoomArchiveListItem[]>(this.baseUrl, {
        headers: this.headers(),
      }),
    );
  }

  getSummary(roomId: string): Promise<AudioRoomArchiveSummary> {
    return firstValueFrom(
      this.http.get<AudioRoomArchiveSummary>(`${this.baseUrl}/${roomId}`, {
        headers: this.headers(),
      }),
    );
  }

  finalize(roomId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/${roomId}/finalize`, {}, { headers: this.headers() }),
    );
  }

  retry(roomId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `${this.baseUrl}/${roomId}/retry`,
        {},
        {
          headers: this.headers(),
        },
      ),
    );
  }

  private headers(): HttpHeaders {
    const token = this.auth.getAccessToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }
}
