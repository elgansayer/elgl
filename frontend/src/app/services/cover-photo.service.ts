import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoverPhotoService {
  private http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/media/cover/upload`;

  async upload(file: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', file, 'cover.webp');
    const result = await firstValueFrom(
      this.http.post<{ coverUrl: string }>(this.endpoint, formData),
    );
    return result.coverUrl;
  }
}
