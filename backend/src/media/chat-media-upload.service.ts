import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import {
  ChatMediaQuality,
  ChatMediaUploadDto,
} from './dto/chat-media-upload.dto';

export type ChatMediaKind = 'image' | 'video';

export interface ChatMediaUploadTicket {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
  mediaKind: ChatMediaKind;
  quality: ChatMediaQuality;
  maxBytes: number;
}

const IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const VIDEO_TYPES = new Map<string, string>([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
]);

const MAX_BYTES: Record<ChatMediaKind, Record<ChatMediaQuality, number>> = {
  image: {
    standard: 6 * 1024 * 1024,
    hd: 15 * 1024 * 1024,
  },
  video: {
    standard: 12 * 1024 * 1024,
    hd: 25 * 1024 * 1024,
  },
};

@Injectable()
export class ChatMediaUploadService {
  constructor(private readonly r2ObjectService: R2ObjectService) {}

  createUploadTicket(
    userId: string,
    dto: ChatMediaUploadDto,
  ): ChatMediaUploadTicket {
    const contentType = this.normaliseContentType(dto.contentType);
    const mediaKind = this.mediaKindFor(contentType);
    const maxBytes = MAX_BYTES[mediaKind][dto.quality];

    if (dto.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `${dto.quality === 'hd' ? 'HD' : 'Standard'} ${mediaKind} exceeds the ${this.formatMegabytes(maxBytes)} MB upload limit`,
      );
    }

    const extension = (mediaKind === 'image' ? IMAGE_TYPES : VIDEO_TYPES).get(
      contentType,
    )!;
    const nonce = randomBytes(12).toString('hex');
    const objectKey = `chat-media/${userId}/${mediaKind}/${dto.quality}/${Date.now()}-${nonce}.${extension}`;
    const upload = this.r2ObjectService.createUploadUrl(
      objectKey,
      contentType,
      maxBytes,
    );

    return {
      uploadUrl: upload.uploadUrl,
      mediaUrl: upload.publicUrl,
      objectKey,
      mediaKind,
      quality: dto.quality,
      maxBytes,
    };
  }

  private mediaKindFor(contentType: string): ChatMediaKind {
    if (IMAGE_TYPES.has(contentType)) return 'image';
    if (VIDEO_TYPES.has(contentType)) return 'video';
    throw new BadRequestException(
      'Only JPEG, PNG, WebP, MP4, WebM, and QuickTime chat media are supported',
    );
  }

  private normaliseContentType(contentType: string): string {
    return contentType.split(';', 1)[0].trim().toLowerCase();
  }

  private formatMegabytes(bytes: number): number {
    return Math.round(bytes / (1024 * 1024));
  }
}
