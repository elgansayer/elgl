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
  @IsIn([
    'text',
    'voice',
    'correction',
    'doodle',
    'sticker',
    'correction_request',
    'status_reply',
    'view_once_media',
  ])
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

  @IsOptional()
  @IsString()
  reply_to_id?: string;

  @IsOptional()
  @IsObject()
  correction_request_payload?: {
    original_text: string;
    target_language?: string;
  };

  @IsOptional()
  @IsObject()
  status_reply_payload?: {
    status_update_id: string;
    status_text: string;
  };
}

export class AiGenerateReplyDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
