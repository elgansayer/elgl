import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class TranscribeVoiceDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  audio_url!: string;
}
