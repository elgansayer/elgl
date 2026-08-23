import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PresignedMediaUploadDto } from './dto/presigned-media-upload.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { AudioCompressionService } from './audio-compression.service';
import { ImageCompressionService } from './image-compression.service';
import { VideoCompressionService } from './video-compression.service';

export type ChatMediaQuality = 'standard' | 'hd';

@Injectable()
export class MediaService {
  private static readonly ALLOWED_IMAGE_CONTENT_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  private static readonly ALLOWED_AUDIO_CONTENT_TYPES = [
    'audio/mpeg',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
    'audio/x-m4a',
  ];

  private static readonly ALLOWED_VIDEO_CONTENT_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  private static readonly MAX_CHAT_IMAGE_BYTES = 20 * 1024 * 1024;
  private static readonly MAX_CHAT_VIDEO_BYTES = 100 * 1024 * 1024;

  constructor(
    private readonly r2ObjectService: R2ObjectService,
    private readonly supabaseService: SupabaseService,
    private readonly audioCompressionService: AudioCompressionService,
    private readonly imageCompressionService: ImageCompressionService,
    private readonly videoCompressionService: VideoCompressionService,
  ) {}

  async generatePresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(dto.filename, 'bin');
    const objectKey = `${dto.folder}/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const upload = this.r2ObjectService.createUploadUrl(objectKey, dto.contentType);

    return {
      uploadUrl: upload.uploadUrl,
      mediaUrl: upload.publicUrl,
      objectKey,
    };
  }

  async generateCoverPresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    this.assertAllowedContentType(
      dto.contentType,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Only JPEG, PNG, and WebP images are allowed',
    );

    return this.generatePresignedUrl(userId, { ...dto, folder: 'covers' });
  }

  async generateAvatarPresignedUrl(
    userId: string,
    dto: PresignedMediaUploadDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    this.assertAllowedContentType(
      dto.contentType,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Only JPEG, PNG, and WebP images are allowed',
    );
    return this.generatePresignedUrl(userId, {
      filename: dto.filename,
      contentType: dto.contentType,
      folder: 'avatars',
    });
  }

  async generateAudioIntroPresignedUrl(
    userId: string,
    dto: PresignedMediaUploadDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    this.assertAllowedContentType(
      dto.contentType,
      MediaService.ALLOWED_AUDIO_CONTENT_TYPES,
      'Only MP3, M4A, WebM, OGG, WAV, and AAC audio files are allowed',
    );
    return this.generatePresignedUrl(userId, {
      filename: dto.filename,
      contentType: dto.contentType,
      folder: 'audio-intros',
    });
  }

  async uploadChatMedia(
    userId: string,
    file: Express.Multer.File,
    quality: ChatMediaQuality,
  ): Promise<{ url: string; mediaType: 'image' | 'video'; quality: ChatMediaQuality }> {
    const contentType = file.mimetype.split(';', 1)[0].trim().toLowerCase();
    const isImage = MediaService.ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType);
    const isVideo = MediaService.ALLOWED_VIDEO_CONTENT_TYPES.includes(contentType);

    if (!isImage && !isVideo) {
      throw new BadRequestException('Only JPEG, PNG, WebP, MP4, WebM, and MOV media are allowed');
    }
    if (quality !== 'standard' && quality !== 'hd') {
      throw new BadRequestException('Quality must be standard or hd');
    }

    const maxBytes = isImage
      ? MediaService.MAX_CHAT_IMAGE_BYTES
      : MediaService.MAX_CHAT_VIDEO_BYTES;
    if (file.size > maxBytes || file.buffer.length > maxBytes) {
      throw new PayloadTooLargeException(
        isImage ? 'Image exceeds the 20 MB limit' : 'Video exceeds the 100 MB limit',
      );
    }

    const uniqueHash = randomBytes(8).toString('hex');
    if (isImage) {
      const bytes =
        quality === 'standard'
          ? await this.imageCompressionService.compress(file.buffer, contentType)
          : file.buffer;
      const extension = this.safeExtension(file.originalname, contentType === 'image/png' ? 'png' : 'jpg');
      const objectKey = `chat-media/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
      const object = await this.r2ObjectService.uploadBytes(objectKey, contentType, bytes);
      return { url: object.publicUrl, mediaType: 'image', quality };
    }

    if (quality === 'hd') {
      const extension = this.safeExtension(file.originalname, contentType === 'video/webm' ? 'webm' : 'mp4');
      const objectKey = `chat-media/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
      const object = await this.r2ObjectService.uploadBytes(objectKey, contentType, file.buffer);
      return { url: object.publicUrl, mediaType: 'video', quality };
    }

    const inputExtension = this.safeExtension(file.originalname, 'video');
    const inputPath = path.join(os.tmpdir(), `${Date.now()}-${uniqueHash}.${inputExtension}`);
    const outputPath = path.join(os.tmpdir(), `${Date.now()}-${uniqueHash}-standard.mp4`);
    try {
      await fs.writeFile(inputPath, file.buffer);
      await this.videoCompressionService.compressToStandardMp4(inputPath, outputPath);
      const output = await fs.readFile(outputPath);
      const objectKey = `chat-media/${userId}/${Date.now()}-${uniqueHash}.mp4`;
      const object = await this.r2ObjectService.uploadBytes(objectKey, 'video/mp4', output);
      return { url: object.publicUrl, mediaType: 'video', quality };
    } finally {
      await fs.unlink(inputPath).catch(() => undefined);
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }

  async uploadAndCompressVoiceNote(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    this.assertAllowedContentType(
      file.mimetype,
      MediaService.ALLOWED_AUDIO_CONTENT_TYPES,
      'Unsupported voice note format',
    );

    const randomName = randomBytes(8).toString('hex');
    const safeExtension = this.safeExtension(file.originalname, 'bin');
    const inputPath = path.join(os.tmpdir(), `${Date.now()}-input-${randomName}.${safeExtension}`);
    const outputPath = path.join(os.tmpdir(), `${Date.now()}-output-${randomName}.ogg`);

    try {
      await fs.writeFile(inputPath, file.buffer);
      await this.audioCompressionService.compressToOgg(inputPath, outputPath);
      const compressedBuffer = await fs.readFile(outputPath);
      const objectKey = `voice-notes/${userId}/${Date.now()}-${randomName}.ogg`;
      const object = await this.r2ObjectService.uploadBytes(objectKey, 'audio/ogg', compressedBuffer);
      return { url: object.publicUrl };
    } finally {
      await fs.unlink(inputPath).catch(() => undefined);
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }

  async confirmCoverUpload(
    userId: string,
    objectKey: string,
  ): Promise<{ coverUrl: string }> {
    const object = await this.r2ObjectService.downloadObject(objectKey);
    this.assertAllowedContentType(
      object.contentType,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Uploaded cover image has an unsupported content type',
    );
    const compressedBuffer = await this.imageCompressionService.compress(
      Buffer.from(object.bytes),
      object.contentType,
    );
    const stored = await this.r2ObjectService.uploadBytes(
      objectKey,
      object.contentType,
      compressedBuffer,
    );

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('users').update({ cover_url: stored.publicUrl }).eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl: stored.publicUrl };
  }

  async processUploadedImage(objectKey: string): Promise<void> {
    const object = await this.r2ObjectService.downloadObject(objectKey);
    this.assertAllowedContentType(
      object.contentType,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Uploaded image has an unsupported content type',
    );
    const compressedBuffer = await this.imageCompressionService.compress(
      Buffer.from(object.bytes),
      object.contentType,
    );
    await this.r2ObjectService.uploadBytes(objectKey, object.contentType, compressedBuffer);
  }

  async uploadAndSetCoverImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ coverUrl: string }> {
    this.assertAllowedContentType(
      file.mimetype,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Only JPEG, PNG, and WebP images are allowed',
    );
    const compressedBuffer = await this.imageCompressionService.compress(file.buffer, file.mimetype);
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(file.originalname, 'jpg');
    const objectKey = `covers/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const object = await this.r2ObjectService.uploadBytes(objectKey, file.mimetype, compressedBuffer);

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('users').update({ cover_url: object.publicUrl }).eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl: object.publicUrl };
  }

  async uploadAndSetAvatarImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    this.assertAllowedContentType(
      file.mimetype,
      MediaService.ALLOWED_IMAGE_CONTENT_TYPES,
      'Only JPEG, PNG, and WebP images are allowed',
    );
    const compressedBuffer = await this.imageCompressionService.compress(file.buffer, file.mimetype);
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(file.originalname, 'jpg');
    const objectKey = `avatars/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const object = await this.r2ObjectService.uploadBytes(objectKey, file.mimetype, compressedBuffer);

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('users').update({ avatar_url: object.publicUrl }).eq('id', userId);

    if (error) {
      throw new Error('Failed to update avatar photo URL');
    }

    return { avatarUrl: object.publicUrl };
  }

  async markMediaAsViewed(userId: string, mediaId: string): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();
    const { data: media, error: fetchError } = await supabase
      .from('media')
      .select('id, view_once, viewed')
      .eq('id', mediaId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !media) {
      throw new BadRequestException('Media not found or access denied');
    }
    if (!media.view_once || media.viewed) {
      throw new BadRequestException('Media is not view-once or already viewed');
    }

    const { error: updateError } = await supabase.from('media').update({ viewed: true }).eq('id', mediaId);

    if (updateError) {
      throw new Error('Failed to mark media as viewed');
    }

    return { success: true };
  }

  private assertAllowedContentType(
    contentType: string,
    allowedTypes: readonly string[],
    message: string,
  ): void {
    const normalisedContentType = contentType.split(';', 1)[0].trim().toLowerCase();
    if (!allowedTypes.includes(normalisedContentType)) {
      throw new BadRequestException(message);
    }
  }

  private safeExtension(filename: string, fallback: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    const sanitised = extension.replace(/[^a-z0-9]/g, '').slice(0, 10);
    return sanitised || fallback;
  }
}
