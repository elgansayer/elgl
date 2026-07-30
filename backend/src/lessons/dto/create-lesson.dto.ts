import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  content_json?: Record<string, unknown>;

  @IsString()
  language_code!: string;

  @IsOptional()
  @IsNumber()
  difficulty_level?: number;
}
