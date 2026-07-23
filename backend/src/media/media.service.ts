import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MediaService implements OnModuleInit {
  private s3Client!: S3Client;
  private bucket!: string;
  private publicDomain!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
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

    return {
      uploadUrl,
      mediaUrl,
      objectKey,
    };
  }

  async generateCoverPresignedUrl(
    userId: string,
    dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    const coverDto = { ...dto, folder: 'covers' };
    return this.generatePresignedUrl(userId, coverDto);
  }

  async confirmCoverUpload(
    userId: string,
    objectKey: string,
  ): Promise<{ coverUrl: string }> {
    const supabase = this.supabaseService.getClient();
    const coverUrl = `${this.publicDomain}/${objectKey}`;

    const { error } = await supabase
      .from('users')
      .update({ cover_photo_url: coverUrl })
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update cover photo URL');
    }

    return { coverUrl };
  }
}
