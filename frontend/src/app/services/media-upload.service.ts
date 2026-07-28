import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface UploadedMedia {
  mediaUrl: string;
  objectKey: string;
  mediaKind: 'image' | 'video';
  /** Local object-URL for instant preview before the R2 upload resolves */
  previewUrl: string;
  filename: string;
  contentType: string;
  /** Upload progress 0-100, undefined when done */
  progress?: number;
}

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private get headers(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /**
   * Request a presigned upload URL from the backend, then PUT the file directly
   * to Cloudflare R2. Returns the final public media URL and mediaKind.
   *
   * @param file - The File object to upload
   * @param onProgress - Optional callback receiving 0-100 progress
   */
  async uploadMomentMedia(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<Omit<UploadedMedia, 'previewUrl'>> {
    // 1. Get presigned URL from backend
    const presigned = await firstValueFrom(
      this.http.post<{
        uploadUrl: string;
        mediaUrl: string;
        objectKey: string;
        mediaKind: 'image' | 'video';
      }>(
        `${environment.apiUrl}/media/moments/presigned-url`,
        {
          filename: file.name,
          contentType: file.type,
          folder: file.type.startsWith('video/') ? 'moments-video' : 'moments',
        },
        { headers: this.headers },
      ),
    );

    // 2. PUT to R2 with XHR so we can track progress
    await this.putWithProgress(presigned.uploadUrl, file, onProgress);

    return {
      mediaUrl: presigned.mediaUrl,
      objectKey: presigned.objectKey,
      mediaKind: presigned.mediaKind,
      filename: file.name,
      contentType: file.type,
    };
  }

  private putWithProgress(
    url: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(file);
    });
  }
}
