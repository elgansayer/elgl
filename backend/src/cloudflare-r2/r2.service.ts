import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;
  private publicUrlBase: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT')!;
    const accessKeyId = this.configService.get<string>(
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
    )!;
    const secretAccessKey = this.configService.get<string>(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    )!;
    this.bucket = this.configService.get<string>('CLOUDFLARE_R2_BUCKET')!;
    this.endpoint = endpoint;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.publicUrlBase =
      this.configService.get<string>('CLOUDFLARE_R2_PUBLIC_URL') ??
      `${endpoint}/${this.bucket}`;
  }

  async generateUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const sanitised = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const key = `voice_notes/${sanitised}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 3600,
    });
    const publicUrl = `${this.publicUrlBase}/${key}`;
    return { uploadUrl, publicUrl };
  }
}
