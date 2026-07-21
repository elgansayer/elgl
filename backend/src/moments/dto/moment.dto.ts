import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMomentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text_content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsEnum(['none', 'images', 'audio'])
  media_type?: 'none' | 'images' | 'audio';

  @IsString()
  @IsNotEmpty()
  target_language!: string;
}

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text_content?: string;

  @IsOptional()
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  };
}
