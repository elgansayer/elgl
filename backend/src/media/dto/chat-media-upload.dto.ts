import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CHAT_MEDIA_QUALITIES = ['standard', 'hd'] as const;
export type ChatMediaQuality = (typeof CHAT_MEDIA_QUALITIES)[number];

/**
 * Optional declared intent for an upload. Photos and videos are classified by
 * their MIME type; a doodle is also a PNG, so it has to say what it is.
 */
export const CHAT_MEDIA_PURPOSES = ['doodle'] as const;
export type ChatMediaPurpose = (typeof CHAT_MEDIA_PURPOSES)[number];

export const MAX_CHAT_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;
export const DOODLE_CHAT_MEDIA_CONTENT_TYPE = 'image/png';
export const DOODLE_CHAT_MEDIA_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Presign request for chat photo/video/doodle uploads. The server owns the R2
 * folder, accepted MIME types and per-quality size ceilings; callers only
 * describe the local file they intend to upload.
 */
export class ChatMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contentType!: string;

  @IsIn(CHAT_MEDIA_QUALITIES)
  quality!: ChatMediaQuality;

  @IsInt()
  @Min(1)
  @Max(MAX_CHAT_MEDIA_UPLOAD_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsIn(CHAT_MEDIA_PURPOSES)
  purpose?: ChatMediaPurpose;
}
