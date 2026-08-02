import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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
  ): Promise<{ uploadUrl: string; mediaUrl: string }> {
    const body = { filename, contentType };
    const result = await firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string }>(
        `${this.baseUrl}/presigned-upload`,
        body,
        { headers: this.getHeaders() },
      ),
    );
    return result;
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
  ): Promise<{ audio_url: string | null }> {
    return firstValueFrom(
      this.http.get<{ audio_url: string | null }>(
        `${this.baseUrl}/${userId}`,
        { headers: this.getHeaders() },
      ),
    );
  }
}
