import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CoverPhotoService {
  private http = inject(HttpClient);
  private readonly endpoint = '/api/users/cover-photo';

  async upload(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('cover', blob, 'cover.webp');
    const result = await firstValueFrom(
      this.http.post<{ url: string }>(this.endpoint, formData),
    );
    return result.url;
  }
}
