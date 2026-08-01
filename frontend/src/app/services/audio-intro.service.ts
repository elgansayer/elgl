import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AudioIntroResponse {
  audio_url: string | null;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  mediaUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AudioIntroService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/audio-intro`;

  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token ?? ''}`,
    });
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<PresignedUploadResponse> {
    const body = { filename, contentType };
    const result = await firstValueFrom(
      this.http.post<PresignedUploadResponse>(
        `${this.baseUrl}/presigned-upload`,
        body,
        { headers: this.getHeaders() },
      ),
    );
    return result;
  }

  async uploadAudioBlob(blob: Blob): Promise<string> {
    const contentType = blob.type || 'audio/webm';
    const filename = `audio-intro-${Date.now()}.${
      contentType === 'audio/webm' ? 'webm' : 'mp3'
    }`;
    const { uploadUrl, mediaUrl } = await this.getPresignedUploadUrl(
      filename,
      contentType,
    );

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });

    if (!response.ok) {
      throw new Error('Failed to upload audio blob');
    }

    return mediaUrl;
  }

  async updateAudioIntro(userId: string, audioUrl: string): Promise<void> {
    const body = { audio_url: audioUrl };
    await firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/${userId}`, body, {
        headers: this.getHeaders(),
      }),
    );
  }

  async getAudioIntro(
    userId: string,
  ): Promise<AudioIntroResponse> {
    return firstValueFrom(
      this.http.get<AudioIntroResponse>(
        `${this.baseUrl}/${userId}`,
        { headers: this.getHeaders() },
      ),
    );
  }
}
