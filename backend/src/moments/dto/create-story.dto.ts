import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class CreateStoryDto {
  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsEnum(['none', 'images', 'audio', 'video'])
  media_type?: 'none' | 'images' | 'audio' | 'video';

  @IsOptional()
  @IsString()
  target_language?: string;

  @IsOptional()
  @IsEnum(['vip', 'non-vip'])
  user_type?: 'vip' | 'non-vip'; // Enforce target language limits for non-VIP users

  @IsOptional()
  @IsNumber()
  expireInHours?: number; // defaults to 24 in service

  @IsOptional()
  @IsString()
  voice_note_url?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
