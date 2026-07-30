import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AvatarUploadResponse {
  avatarUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private readonly baseUrl = `${environment.apiUrl}/media`;

  constructor(private readonly http: HttpClient) {}

  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http
      .post<AvatarUploadResponse>(`${this.baseUrl}/avatar/upload`, formData)
      .toPromise()!;
  }
}
