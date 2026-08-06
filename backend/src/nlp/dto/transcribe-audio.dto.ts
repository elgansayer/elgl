import { IsString, IsUrl, IsOptional } from 'class-validator';

export class TranscribeAudioDto {
  @IsString()
  @IsUrl({ require_tld: false })
  audio_url: string;

  @IsOptional()
  @IsString()
  language?: string;
}
