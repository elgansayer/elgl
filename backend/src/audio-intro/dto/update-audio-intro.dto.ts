import { IsOptional, IsString } from 'class-validator';

export class UpdateAudioIntroDto {
  @IsOptional()
  @IsString()
  audio_url?: string;
}
