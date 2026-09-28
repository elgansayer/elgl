import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PronunciationScoreDto {
  @IsString()
  @IsNotEmpty()
  audio_url!: string;

  @IsString()
  @IsNotEmpty()
  target_text!: string;

  @IsOptional()
  @IsString()
  language?: string;
}
