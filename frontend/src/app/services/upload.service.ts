import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';

export interface UploadResult {
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/media`;

  async uploadAvatar(file: Blob, filename: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file, filename);
    const response = await lastValueFrom(
      this.http.post<UploadResult>(`${this.baseUrl}/avatar/upload`, formData),
    );
    return response;
  }
}
