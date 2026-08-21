import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsString()
  @IsIn([
    'avatars',
    'audio-intros',
    'moments',
    'voice-notes',
    'doodles',
    'cover-photos',
  ])
  folder!: string;
}
