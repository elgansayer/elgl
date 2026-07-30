import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateLanguagePartyDto {
  @IsString()
  title!: string;

  @IsString()
  language_pair!: string;

  @IsOptional()
  @IsString()
  topic_tag?: string;

  @IsOptional()
  @IsBoolean()
  is_video_stream?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(2)
  max_speakers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration_minutes?: number;
}
