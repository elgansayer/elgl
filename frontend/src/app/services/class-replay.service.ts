import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export type ClassReplayStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface ClassReplay {
  id: string;
  host_id: string;
  room_id: string | null;
  title: string;
  description: string | null;
  status: ClassReplayStatus;
  hls_url: string | null;
  dash_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  failure_code: string | null;
  ready_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassReplayPlayback {
  replay_id: string;
  status: ClassReplayStatus;
  hls_url: string | null;
  dash_url: string | null;
  download_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  expires_at: string | null;
}

export interface CreateClassReplayPayload {
  roomId?: string;
  title: string;
  description?: string;
  sourceUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ClassReplayService {
  private readonly api = inject(ApiService);
  private readonly baseUrl = `${environment.apiUrl}/class-replays`;

  async listReplays(roomId?: string): Promise<ClassReplay[]> {
    const result = await this.api.get<ClassReplay[]>(this.baseUrl, {
      params: roomId ? { roomId } : undefined,
      fallback: [],
    });
    return Array.isArray(result) ? result : [];
  }

  async getReplay(replayId: string): Promise<ClassReplay> {
    return this.api.get<ClassReplay>(`${this.baseUrl}/${encodeURIComponent(replayId)}`);
  }

  async getPlayback(replayId: string): Promise<ClassReplayPlayback> {
    return this.api.get<ClassReplayPlayback>(
      `${this.baseUrl}/${encodeURIComponent(replayId)}/playback`,
    );
  }

  async createReplay(payload: CreateClassReplayPayload): Promise<ClassReplay> {
    return this.api.post<ClassReplay>(this.baseUrl, payload);
  }

  async retryReplay(replayId: string): Promise<void> {
    await this.api.post<{ queued: boolean }>(
      `${this.baseUrl}/${encodeURIComponent(replayId)}/retry`,
      {},
    );
  }

  async deleteReplay(replayId: string): Promise<void> {
    await this.api.delete<void>(`${this.baseUrl}/${encodeURIComponent(replayId)}`);
  }
}
