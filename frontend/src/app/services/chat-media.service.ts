import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ImageCompressionService } from './image-compression.service';

export type ChatMediaQuality = 'standard' | 'hd';
export type ChatMediaKind = 'image' | 'video';
export type ChatMediaPresentation = 'standard' | 'instant_video';

interface ChatMediaUploadTicket {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
  mediaKind: ChatMediaKind;
  quality: ChatMediaQuality;
  maxBytes: number;
}

export interface UploadedChatMedia {
  url: string;
  objectKey: string;
  kind: ChatMediaKind;
  quality: ChatMediaQuality;
  /** Rendering intent only. The backend still derives the media URL from the owned object key. */
  presentation?: ChatMediaPresentation;
}

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const MAX_BYTES: Record<ChatMediaKind, Record<ChatMediaQuality, number>> = {
  image: { standard: 6 * 1024 * 1024, hd: 15 * 1024 * 1024 },
  video: { standard: 12 * 1024 * 1024, hd: 25 * 1024 * 1024 },
};

@Injectable({ providedIn: 'root' })
export class ChatMediaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly imageCompression = inject(ImageCompressionService);
  private readonly endpoint = `${environment.apiUrl}/media/chat/presigned-url`;

  async upload(file: File, quality: ChatMediaQuality): Promise<UploadedChatMedia> {
    const contentType = file.type.split(';', 1)[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error('Unsupported photo or video format');
    }

    const kind: ChatMediaKind = contentType.startsWith('image/') ? 'image' : 'video';
    const prepared = kind === 'image' ? await this.prepareImage(file, quality) : file;
    const preparedType = prepared.type.split(';', 1)[0].trim().toLowerCase();
    const limit = MAX_BYTES[kind][quality];

    if (prepared.size <= 0 || prepared.size > limit) {
      throw new Error(
        `${quality === 'hd' ? 'HD' : 'Standard'} ${kind} must be under ${Math.round(limit / 1024 / 1024)} MB`,
      );
    }

    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Sign in before uploading chat media');

    const ticket = await firstValueFrom(
      this.http.post<ChatMediaUploadTicket>(
        this.endpoint,
        {
          filename: prepared.name,
          contentType: preparedType,
          quality,
          sizeBytes: prepared.size,
        },
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
      ),
    );

    if (ticket.mediaKind !== kind || ticket.quality !== quality || prepared.size > ticket.maxBytes) {
      throw new Error('Upload ticket did not match the selected media');
    }

    await firstValueFrom(
      this.http.put(ticket.uploadUrl, prepared, {
        headers: new HttpHeaders({ 'Content-Type': preparedType }),
        responseType: 'text',
      }),
    );

    return {
      url: ticket.mediaUrl,
      objectKey: ticket.objectKey,
      kind,
      quality,
    };
  }

  private prepareImage(file: File, quality: ChatMediaQuality): Promise<File> {
    if (quality === 'hd') {
      return this.imageCompression.compressImage(file, 2560, 2560, 0.9);
    }
    return this.imageCompression.compressImage(file, 1600, 1600, 0.78);
  }
}
