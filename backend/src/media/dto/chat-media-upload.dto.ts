import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const CHAT_MEDIA_QUALITIES = ['standard', 'hd'] as const;
export type ChatMediaQuality = (typeof CHAT_MEDIA_QUALITIES)[number];

export const MAX_CHAT_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Presign request for chat photo/video uploads. The server owns the R2 folder,
 * accepted MIME types and per-quality size ceilings; callers only describe the
 * local file they intend to upload.
 */
export class ChatMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsIn(CHAT_MEDIA_QUALITIES)
  quality!: ChatMediaQuality;

  @IsInt()
  @Min(1)
  @Max(MAX_CHAT_MEDIA_UPLOAD_BYTES)
  sizeBytes!: number;
}
