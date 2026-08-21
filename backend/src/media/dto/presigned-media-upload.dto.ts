import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Request body for dedicated pre-signed upload endpoints whose storage folder
 * is determined server-side (avatars, audio intros, covers, voice notes).
 * Clients never supply the R2 object folder for these endpoints.
 */
export class PresignedMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contentType!: string;
}
