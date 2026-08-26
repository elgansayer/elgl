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

interface PresignedMediaUploadResponse {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
}

const MAX_VOICE_NOTE_BYTES = 10 * 1024 * 1024;

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

  async uploadVoiceNote(blob: Blob): Promise<VoiceNoteUploadResponse> {
    if (blob.size === 0 || blob.size > MAX_VOICE_NOTE_BYTES) {
      throw new Error('Voice note is outside the supported upload size');
    }

    const contentType = blob.type || 'audio/webm';
    const filename = `voice_${Date.now()}.${this.audioExtension(contentType)}`;
    const presigned = await firstValueFrom(
      this.http.post<PresignedMediaUploadResponse>(`${this.baseUrl}/voice-note/presigned-url`, {
        filename,
        contentType,
      }),
    );

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!uploadResponse.ok) {
      throw new Error('Voice note upload failed');
    }

    return { url: presigned.mediaUrl };
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

  private audioExtension(contentType: string): string {
    switch (contentType.split(';', 1)[0].trim().toLowerCase()) {
      case 'audio/ogg':
        return 'ogg';
      case 'audio/mp4':
      case 'audio/x-m4a':
        return 'm4a';
      case 'audio/mpeg':
        return 'mp3';
      case 'audio/wav':
        return 'wav';
      case 'audio/aac':
        return 'aac';
      default:
        return 'webm';
    }
  }
}
