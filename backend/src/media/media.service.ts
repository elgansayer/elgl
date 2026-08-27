import { BadRequestException, Injectable } from '@nestjs/common';
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

  private static readonly MAX_OBJECT_KEY_LENGTH = 512;

  constructor(
    private readonly r2ObjectService: R2ObjectService,
    private readonly supabaseService: SupabaseService,
    private readonly audioCompressionService: AudioCompressionService,
    private readonly imageCompressionService: ImageCompressionService,
  ) {}

  async generatePresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(dto.filename, 'bin');
    const objectKey = `${dto.folder}/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const upload = this.r2ObjectService.createUploadUrl(
      objectKey,
      dto.contentType,
    );

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
    const inputPath = path.join(
      os.tmpdir(),
      `${Date.now()}-input-${randomName}.${safeExtension}`,
    );
    const outputPath = path.join(
      os.tmpdir(),
      `${Date.now()}-output-${randomName}.ogg`,
    );

    try {
      await fs.writeFile(inputPath, file.buffer);
      await this.audioCompressionService.compressToOgg(inputPath, outputPath);
      const compressedBuffer = await fs.readFile(outputPath);
      const objectKey = `voice-notes/${userId}/${Date.now()}-${randomName}.ogg`;
      const object = await this.r2ObjectService.uploadBytes(
        objectKey,
        'audio/ogg',
        compressedBuffer,
      );
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
    this.assertOwnedObjectKey(userId, objectKey, 'covers');

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
    const { error } = await supabase
      .from('users')
      .update({ cover_url: stored.publicUrl })
      .eq('id', userId);

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
    await this.r2ObjectService.uploadBytes(
      objectKey,
      object.contentType,
      compressedBuffer,
    );
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
    const compressedBuffer = await this.imageCompressionService.compress(
      file.buffer,
      file.mimetype,
    );
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(file.originalname, 'jpg');
    const objectKey = `covers/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const object = await this.r2ObjectService.uploadBytes(
      objectKey,
      file.mimetype,
      compressedBuffer,
    );

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ cover_url: object.publicUrl })
      .eq('id', userId);

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
    const compressedBuffer = await this.imageCompressionService.compress(
      file.buffer,
      file.mimetype,
    );
    const uniqueHash = randomBytes(8).toString('hex');
    const extension = this.safeExtension(file.originalname, 'jpg');
    const objectKey = `avatars/${userId}/${Date.now()}-${uniqueHash}.${extension}`;
    const object = await this.r2ObjectService.uploadBytes(
      objectKey,
      file.mimetype,
      compressedBuffer,
    );

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: object.publicUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update avatar photo URL');
    }

    return { avatarUrl: object.publicUrl };
  }

  async markMediaAsViewed(
    userId: string,
    mediaId: string,
  ): Promise<{ success: boolean }> {
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

    const { error: updateError } = await supabase
      .from('media')
      .update({ viewed: true })
      .eq('id', mediaId);

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
    const normalisedContentType = contentType
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!allowedTypes.includes(normalisedContentType)) {
      throw new BadRequestException(message);
    }
  }

  private assertOwnedObjectKey(
    userId: string,
    objectKey: string,
    folder: string,
  ): void {
    if (
      typeof objectKey !== 'string' ||
      objectKey.length === 0 ||
      objectKey.length > MediaService.MAX_OBJECT_KEY_LENGTH
    ) {
      throw new BadRequestException('Invalid media object key');
    }

    const prefix = `${folder}/${userId}/`;
    const objectName = objectKey.startsWith(prefix)
      ? objectKey.slice(prefix.length)
      : '';

    if (
      objectName.length === 0 ||
      objectName.includes('/') ||
      objectName.includes('\\') ||
      objectName === '.' ||
      objectName === '..'
    ) {
      throw new BadRequestException('Media object is not owned by this user');
    }
  }

  private safeExtension(filename: string, fallback: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    const sanitised = extension.replace(/[^a-z0-9]/g, '').slice(0, 10);
    return sanitised || fallback;
  }
}
