import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AvatarUploadResponse {
  avatarUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/media`;

  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return firstValueFrom(
      this.http.post<AvatarUploadResponse>(`${this.baseUrl}/avatar/upload`, formData),
    );
  }
}
