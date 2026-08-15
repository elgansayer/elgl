import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ImageCompressionService } from './image-compression.service';
import { SupabaseService } from './supabase.service';

export interface VoiceNoteUploadResponse {
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly imageCompression = inject(ImageCompressionService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly baseUrl = `${environment.apiUrl}/media`;

  async uploadVoiceNote(
    blob: Blob,
    format: 'ogg' | 'm4a' = 'ogg',
  ): Promise<VoiceNoteUploadResponse> {
    const formData = new FormData();
    const filename = `voice_${Date.now()}.webm`;
    formData.append('file', new File([blob], filename, { type: blob.type || 'audio/webm' }));
    formData.append('format', format);

    return firstValueFrom(
      this.http.post<VoiceNoteUploadResponse>(`${this.baseUrl}/voice-note`, formData),
    );
  }

  async markMediaAsViewed(mediaId: string): Promise<void> {
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/view-once/mark-viewed`, { mediaId }),
    );
  }

  async clearMediaCache(): Promise<void> {
    await this.supabaseService.clearOfflineCache();
  }
}
