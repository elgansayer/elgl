import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  title!: string;

  @IsString()
  cefrLevel!: string;

  @IsString()
  language!: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsString()
  contentText!: string;

  @IsOptional()
  @IsInt()
  wordCount?: number;

  @IsOptional()
  @IsInt()
  difficultyRating?: number;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
