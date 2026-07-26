import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { AudioCompressionService } from './audio-compression.service';

@Injectable()
export class MediaService implements OnModuleInit {
  private s3Client!: S3Client;
  private bucket!: string;
  private publicDomain!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly audioCompressionService: AudioCompressionService,
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

  async uploadAndCompressVoiceNote(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${Date.now()}-input-${file.originalname}`);
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
    const supabase = this.supabaseService.getClient();
    const coverUrl = `${this.publicDomain}/${objectKey}`;

    const { error } = await supabase
      .from('users')
      .update({ cover_url: coverUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl };
  }
}
