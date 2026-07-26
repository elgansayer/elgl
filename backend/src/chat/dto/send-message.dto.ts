import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsIn(['text', 'voice', 'correction', 'doodle', 'sticker'])
  message_type!: string;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsObject()
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  };
}
