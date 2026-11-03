import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ChatMediaQuality,
  ChatMediaUploadDto,
  DOODLE_CHAT_MEDIA_CONTENT_TYPE,
  DOODLE_CHAT_MEDIA_MAX_BYTES,
} from './dto/chat-media-upload.dto';

export type ChatMediaKind = 'image' | 'video';
export type ChatUploadKind = ChatMediaKind | 'doodle';

export interface ChatMediaUploadTicket {
  uploadUrl: string;
  mediaUrl: string;
  objectKey: string;
  mediaKind: ChatUploadKind;
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

// A doodle is a fixed-size canvas export. Even an incompressible 600 x 400 RGBA
// raster is under 1 MiB, so 2 MiB leaves headroom without inviting abuse.
@Injectable()
export class ChatMediaUploadService {
  constructor(
    private readonly r2ObjectService: R2ObjectService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createUploadTicket(
    userId: string,
    dto: ChatMediaUploadDto,
  ): Promise<ChatMediaUploadTicket> {
    const contentType = this.normaliseContentType(dto.contentType);
    if (dto.purpose === 'doodle') {
      return this.createDoodleTicket(userId, dto, contentType);
    }

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

  private async createDoodleTicket(
    userId: string,
    dto: ChatMediaUploadDto,
    contentType: string,
  ): Promise<ChatMediaUploadTicket> {
    if (contentType !== DOODLE_CHAT_MEDIA_CONTENT_TYPE) {
      throw new BadRequestException('Doodles must be PNG images');
    }
    if (dto.quality !== 'standard') {
      throw new BadRequestException('Doodles only support standard quality');
    }
    if (dto.sizeBytes > DOODLE_CHAT_MEDIA_MAX_BYTES) {
      throw new BadRequestException(
        `Doodle exceeds the ${this.formatMegabytes(DOODLE_CHAT_MEDIA_MAX_BYTES)} MB upload limit`,
      );
    }

    const nonce = randomBytes(12).toString('hex');
    const objectKey = `chat-media/${userId}/doodle/standard/${Date.now()}-${nonce}.png`;
    const upload = this.r2ObjectService.createUploadUrl(
      objectKey,
      DOODLE_CHAT_MEDIA_CONTENT_TYPE,
      DOODLE_CHAT_MEDIA_MAX_BYTES,
    );

    const ticket: ChatMediaUploadTicket = {
      uploadUrl: upload.uploadUrl,
      mediaUrl: upload.publicUrl,
      objectKey,
      mediaKind: 'doodle',
      quality: 'standard',
      maxBytes: DOODLE_CHAT_MEDIA_MAX_BYTES,
    };

    await this.persistDoodleIntent(userId, objectKey);
    return ticket;
  }

  private async persistDoodleIntent(
    userId: string,
    objectKey: string,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { error } = await this.supabaseService
      .getClient()
      .from('chat_media_upload_intents')
      .insert({
        object_key: objectKey,
        user_id: userId,
        media_kind: 'doodle',
        expires_at: expiresAt.toISOString(),
      });
    if (error) {
      throw new ServiceUnavailableException(
        'Unable to create doodle upload intent',
      );
    }
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
