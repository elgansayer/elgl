import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class PronunciationScoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  audio_url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  target_text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
  language?: string;
}
