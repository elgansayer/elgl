import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioCompressionService } from './audio-compression.service';
import { ImageCompressionService } from './image-compression.service';

@Injectable()
export class MediaService implements OnModuleInit {
  private s3Client!: S3Client;
  private bucket!: string;
  private publicDomain!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly audioCompressionService: AudioCompressionService,
    private readonly imageCompressionService: ImageCompressionService,
  ) {}

  onModuleInit() {
    const endpoint = this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT')!;
    const accessKeyId = this.configService.get<string>(
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
    )!;
    const secretAccessKey = this.configService.get<string>(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    )!;
    this.bucket = this.configService.get<string>('CLOUDFLARE_R2_BUCKET')!;
    this.publicDomain = this.configService.get<string>(
      'CLOUDFLARE_R2_PUBLIC_DOMAIN',
    )!;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async generatePresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const extension = dto.filename.split('.').pop() || 'bin';
    const objectKey = `${dto.folder}/${userId}/${Date.now()}-${uniqueHash}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    const mediaUrl = `${this.publicDomain}/${objectKey}`;

    return { uploadUrl, mediaUrl, objectKey };
  }

  async generateCoverPresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    const coverDto = { ...dto, folder: 'covers' };
    return this.generatePresignedUrl(userId, coverDto);
  }

  async generateAvatarPresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }

    const avatarDto = { ...dto, folder: 'avatars' };
    return this.generatePresignedUrl(userId, avatarDto);
  }

  async generateAudioIntroPresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const allowedTypes = [
      'audio/ogg',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'audio/wav',
    ];
    if (!allowedTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        'Only OGG, MP3, MP4, WebM, and WAV audio files are allowed',
      );
    }

    const audioDto = { ...dto, folder: 'audio-intros' };
    return this.generatePresignedUrl(userId, audioDto);
  }

  async uploadAndCompressVoiceNote(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const tempDir = os.tmpdir();
    const safeExt = path
      .extname(file.originalname)
      .replace(/[^a-zA-Z0-9.]/g, '');
    const randomName = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(
      tempDir,
      `${Date.now()}-input-${randomName}${safeExt}`,
    );
    const outputPath = path.join(tempDir, `${Date.now()}-output.ogg`);

    try {
      // 1. Save uploaded buffer to temp file
      await fs.writeFile(inputPath, file.buffer);

      // 2. Compress to OGG
      await this.audioCompressionService.compressToOgg(inputPath, outputPath);

      // 3. Read compressed file and upload to R2
      const compressedBuffer = await fs.readFile(outputPath);
      const uniqueHash = crypto.randomBytes(8).toString('hex');
      const objectKey = `voice-notes/${userId}/${Date.now()}-${uniqueHash}.ogg`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: compressedBuffer,
        ContentType: 'audio/ogg',
      });

      await this.s3Client.send(command);

      return { url: `${this.publicDomain}/${objectKey}` };
    } finally {
      // 4. Clean up temp files
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }

  async confirmCoverUpload(
    userId: string,
    objectKey: string,
  ): Promise<{ coverUrl: string }> {
    const bucket = this.bucket;
    const key = objectKey;

    // 1. Retrieve object metadata (ContentType)
    let contentType: string;
    try {
      const headResult = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      contentType = headResult.ContentType || 'image/jpeg';
    } catch {
      contentType = 'image/jpeg';
    }

    // 2. Download original object
    const getResult = await this.s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const stream = getResult.Body as import('stream').Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const originalBuffer = Buffer.concat(chunks);

    // 3. Compress image
    const compressedBuffer = await this.imageCompressionService.compress(
      originalBuffer,
      contentType,
    );

    // 4. Overwrite with compressed version
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressedBuffer,
        ContentType: contentType,
      }),
    );

    // 5. Update user record (same URL)
    const supabase = this.supabaseService.getClient();
    const coverUrl = `${this.publicDomain}/${key}`;
    const { error } = await supabase
      .from('users')
      .update({ cover_url: coverUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl };
  }

  async confirmAvatarUpload(
    userId: string,
    objectKey: string,
  ): Promise<{ avatarUrl: string }> {
    const bucket = this.bucket;
    const key = objectKey;

    // 1. Retrieve object metadata (ContentType)
    let contentType: string;
    try {
      const headResult = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      contentType = headResult.ContentType || 'image/jpeg';
    } catch {
      contentType = 'image/jpeg';
    }

    // 2. Download original object
    const getResult = await this.s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const stream = getResult.Body as import('stream').Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const originalBuffer = Buffer.concat(chunks);

    // 3. Compress image
    const compressedBuffer = await this.imageCompressionService.compress(
      originalBuffer,
      contentType,
    );

    // 4. Overwrite with compressed version
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressedBuffer,
        ContentType: contentType,
      }),
    );

    // 5. Update user record
    const supabase = this.supabaseService.getClient();
    const avatarUrl = `${this.publicDomain}/${key}`;
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update avatar photo URL');
    }

    return { avatarUrl };
  }

  async confirmAudioIntroUpload(
    userId: string,
    objectKey: string,
  ): Promise<{ audioIntroUrl: string }> {
    const key = objectKey;

    // Verify the object exists
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      throw new BadRequestException('Audio intro file not found in storage');
    }

    // Update user record
    const supabase = this.supabaseService.getClient();
    const audioIntroUrl = `${this.publicDomain}/${key}`;
    const { error } = await supabase
      .from('users')
      .update({ audio_intro_url: audioIntroUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update audio intro URL');
    }

    return { audioIntroUrl };
  }

  async processUploadedImage(objectKey: string): Promise<void> {
    // Retrieve object metadata (ContentType)
    let contentType: string;
    try {
      const headResult = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      contentType = headResult.ContentType || 'image/jpeg';
    } catch {
      contentType = 'image/jpeg';
    }

    // Download original object
    const getResult = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    const stream = getResult.Body as import('stream').Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const originalBuffer = Buffer.concat(chunks);

    // Compress image
    const compressedBuffer = await this.imageCompressionService.compress(
      originalBuffer,
      contentType,
    );

    // Overwrite with compressed version
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: compressedBuffer,
        ContentType: contentType,
      }),
    );
  }

  async uploadAndSetCoverImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ coverUrl: string }> {
    // 1. Compress image
    const compressedBuffer = await this.imageCompressionService.compress(
      file.buffer,
      file.mimetype,
    );

    // 2. Generate unique object key
    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const extension = file.originalname.split('.').pop() || 'jpg';
    const objectKey = `covers/${userId}/${Date.now()}-${uniqueHash}.${extension}`;

    // 3. Upload compressed buffer to R2
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: compressedBuffer,
      ContentType: file.mimetype || 'image/jpeg',
    });

    await this.s3Client.send(command);

    const coverUrl = `${this.publicDomain}/${objectKey}`;

    // 4. Update user record
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ cover_url: coverUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl };
  }

  async uploadAndSetAvatarImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    // 1. Compress image
    const compressedBuffer = await this.imageCompressionService.compress(
      file.buffer,
      file.mimetype,
    );

    // 2. Generate unique object key
    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const extension = file.originalname.split('.').pop() || 'jpg';
    const objectKey = `avatars/${userId}/${Date.now()}-${uniqueHash}.${extension}`;

    // 3. Upload compressed buffer to R2
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: compressedBuffer,
      ContentType: file.mimetype || 'image/jpeg',
    });

    await this.s3Client.send(command);

    const avatarUrl = `${this.publicDomain}/${objectKey}`;

    // 4. Update user record
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update avatar photo URL');
    }

    return { avatarUrl };
  }
  async markMediaAsViewed(
    userId: string,
    mediaId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if the media exists and belongs to the user
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

    // Mark the media as viewed
    const { error: updateError } = await supabase
      .from('media')
      .update({ viewed: true })
      .eq('id', mediaId);

    if (updateError) {
      throw new Error('Failed to mark media as viewed');
    }

    return { success: true };
  }
}
