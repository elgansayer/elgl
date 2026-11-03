import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ImageCompressionService } from './image-compression.service';

export type ChatMediaQuality = 'standard' | 'hd';
export type ChatMediaKind = 'image' | 'video';
/** Everything the chat media pipeline can upload: photos, videos and doodles. */
export type ChatUploadKind = ChatMediaKind | 'doodle';
export type ChatMediaPresentation = 'standard' | 'instant_video';

interface ChatMediaUploadRequest {
  filename: string;
  contentType: string;
  quality: ChatMediaQuality;
  sizeBytes: number;
  /** Only sent for doodles: a doodle is a PNG like any photo, so the server needs the intent. */
  purpose?: 'doodle';
}

interface ChatMediaUploadTicket {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
  mediaKind: ChatUploadKind;
  quality: ChatMediaQuality;
  maxBytes: number;
}

export interface UploadedChatMedia {
  url: string;
  objectKey: string;
  kind: ChatUploadKind;
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

const DOODLE_DATA_URL_PREFIX = 'data:image/png;base64,';
const DOODLE_MAX_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Decodes the PNG data URL exported by the doodle pad into the bytes that are uploaded. The
 * decode is local on purpose: a `fetch(dataUrl)` shortcut would need `data:` in the connect-src
 * policy. Anything that is not a bounded, signature-valid PNG is rejected before any network I/O.
 */
function pngBlobFromDataUrl(dataUrl: string): Blob {
  if (!dataUrl.startsWith(DOODLE_DATA_URL_PREFIX)) {
    throw new Error('Doodle is not a PNG image');
  }

  let binary: string;
  try {
    binary = atob(dataUrl.slice(DOODLE_DATA_URL_PREFIX.length));
  } catch {
    throw new Error('Doodle image data is malformed');
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Doodle is not a PNG image');
  }
  if (bytes.byteLength > DOODLE_MAX_BYTES) {
    throw new Error(`Doodle must be under ${DOODLE_MAX_BYTES / 1024 / 1024} MB`);
  }
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * A log-safe description of an upload or send failure. An HTTP failure reports only its status:
 * its message and URL can carry the signed upload token, and a request body can be private media.
 */
export function describeChatMediaFailure(error: unknown): string {
  if (error instanceof HttpErrorResponse) return `HTTP ${error.status}`;
  if (error instanceof Error) return error.message;
  return 'Unknown failure';
}

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

    return this.transfer(prepared, kind, quality, {
      filename: prepared.name,
      contentType: preparedType,
      quality,
      sizeBytes: prepared.size,
    });
  }

  /**
   * Uploads the PNG exported by the doodle pad to the same owned-object pipeline as photos. The
   * returned object key is a stable retry key: sending it again resolves the already persisted
   * message instead of creating a second doodle, so a failed send never needs a second upload.
   */
  async uploadDoodle(dataUrl: string): Promise<UploadedChatMedia> {
    const png = pngBlobFromDataUrl(dataUrl);

    return this.transfer(png, 'doodle', 'standard', {
      filename: 'doodle.png',
      contentType: 'image/png',
      quality: 'standard',
      sizeBytes: png.size,
      purpose: 'doodle',
    });
  }

  private async transfer(
    payload: Blob,
    kind: ChatUploadKind,
    quality: ChatMediaQuality,
    request: ChatMediaUploadRequest,
  ): Promise<UploadedChatMedia> {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Sign in before uploading chat media');

    const ticket = await firstValueFrom(
      this.http.post<ChatMediaUploadTicket>(this.endpoint, request, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      }),
    );

    if (ticket.mediaKind !== kind || ticket.quality !== quality || payload.size > ticket.maxBytes) {
      throw new Error('Upload ticket did not match the selected media');
    }

    await firstValueFrom(
      this.http.put(ticket.uploadUrl, payload, {
        headers: new HttpHeaders({ 'Content-Type': request.contentType }),
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
