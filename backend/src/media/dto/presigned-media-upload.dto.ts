import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body for dedicated pre-signed upload endpoints whose storage folder
 * is determined server-side (avatars, audio intros, covers). Clients never
 * supply the R2 object folder for these endpoints.
 */
export class PresignedMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
