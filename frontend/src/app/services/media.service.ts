import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ImageCompressionService } from './image-compression.service';
import { SupabaseService } from './supabase.service';

export interface AvatarUploadResponse {
  avatarUrl: string;
}

export interface VoiceNoteUploadResponse {
  url: string;
}

export type ChatMediaQuality = 'standard' | 'hd';

export interface ChatMediaUploadResponse {
  url: string;
  mediaType: 'image' | 'video';
  quality: ChatMediaQuality;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly imageCompression = inject(ImageCompressionService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly baseUrl = `${environment.apiUrl}/media`;

  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    // Compress image client-side before uploading
    const compressed = await this.imageCompression.compressImage(file);
    const formData = new FormData();
    formData.append('file', compressed, compressed.name);

    return firstValueFrom(
      this.http.post<AvatarUploadResponse>(`${this.baseUrl}/avatar/upload`, formData),
    );
  }

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

  async uploadChatMedia(
    file: File,
    quality: ChatMediaQuality = 'standard',
  ): Promise<ChatMediaUploadResponse> {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error('Unsupported chat media type');
    }

    const maxBytes = file.type.startsWith('image/') ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error('Chat media exceeds the upload limit');
    }

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('quality', quality);

    return firstValueFrom(
      this.http.post<ChatMediaUploadResponse>(`${this.baseUrl}/chat`, formData),
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
