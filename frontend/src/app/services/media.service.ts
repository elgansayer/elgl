import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ImageCompressionService } from './image-compression.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface AvatarUploadResponse {
  avatarUrl: string;
}

export interface VoiceNoteUploadResponse {
  url: string;
}

export interface PresignedVoiceNoteResponse {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly imageCompression = inject(ImageCompressionService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/media`;

  async getVoiceNotePresignedUrl(
    filename: string,
    contentType: string,
  ): Promise<PresignedVoiceNoteResponse> {
    const token = this.authService.getAccessToken();
    return firstValueFrom(
      this.http.post<PresignedVoiceNoteResponse>(
        `${this.baseUrl}/voice-note/presigned-url`,
        { filename, contentType, folder: 'voice-notes' },
        {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        },
      ),
    );
  }

  async uploadVoiceNoteDirectToR2(
    blob: Blob,
  ): Promise<string> {
    const contentType = blob.type || 'audio/webm';
    const ext = contentType === 'audio/ogg' ? 'ogg'
      : contentType === 'audio/mpeg' ? 'mp3'
      : contentType === 'audio/wav' ? 'wav'
      : 'webm';
    const filename = `voice_${Date.now()}.${ext}`;
    const { uploadUrl, mediaUrl } = await this.getVoiceNotePresignedUrl(
      filename,
      contentType,
    );

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload voice note to R2: ${response.status}`);
    }

    return mediaUrl;
  }

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
