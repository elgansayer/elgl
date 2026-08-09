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

  @IsOptional()
  @IsEnum(['moment', 'question', 'language_question'])
  post_type?: 'moment' | 'question' | 'language_question';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  question_text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  question_options?: string[];

  @IsOptional()
  @IsString()
  correct_answer?: string;

  @IsOptional()
  @IsString()
  voice_note_url?: string;

  @IsOptional()
  @IsEnum(['vip', 'non-vip'])
  user_type?: 'vip' | 'non-vip'; // Enforce AI usage limits for non-VIP users
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
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

  @IsOptional()
  @IsString()
  parent_comment_id?: string;

  @IsOptional()
  @IsString()
  reply_to_user_id?: string;
}
