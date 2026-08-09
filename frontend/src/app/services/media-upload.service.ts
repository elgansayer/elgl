import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ImageCompressionService } from './image-compression.service';

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
  private imageCompression = inject(ImageCompressionService);

  private get headers(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /**
   * Request a presigned upload URL from the backend, then compress and PUT the
   * file directly to Cloudflare R2. Images are compressed client-side to max
   * 1080p before upload to save bandwidth.
   *
   * @param file - The File object to upload
   * @param onProgress - Optional callback receiving 0-100 progress
   */
  async uploadMomentMedia(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<Omit<UploadedMedia, 'previewUrl'>> {
    // Compress images client-side before upload (max 1080p)
    const uploadFile = file.type.startsWith('image/')
      ? await this.imageCompression.compressImage(file)
      : file;

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
          filename: uploadFile.name,
          contentType: uploadFile.type,
          folder: uploadFile.type.startsWith('video/') ? 'moments-video' : 'moments',
        },
        { headers: this.headers },
      ),
    );

    // 2. PUT to R2 with XHR so we can track progress
    await this.putWithProgress(presigned.uploadUrl, uploadFile, onProgress);

    return {
      mediaUrl: presigned.mediaUrl,
      objectKey: presigned.objectKey,
      mediaKind: presigned.mediaKind,
      filename: uploadFile.name,
      contentType: uploadFile.type,
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
