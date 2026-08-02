import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  content_json?: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  language_code!: string;

  @IsOptional()
  @IsNumber()
  difficulty_level?: number;

  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @IsOptional()
  @IsString()
  audio_url?: string;
}
