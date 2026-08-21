import { IsString, IsOptional } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  url!: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  type?: string; // 'post' | 'tip' | undefined

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  difficulty?: string; // e.g., 'beginner', 'intermediate', 'advanced'
}
