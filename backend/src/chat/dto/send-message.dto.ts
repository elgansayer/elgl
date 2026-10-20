import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const MEDIA_MESSAGE_TYPES = [
  'voice',
  'doodle',
  'sticker',
  'view_once_media',
] as const;

export class CorrectionPayloadDto {
  @IsString()
  @Matches(/\S/, { message: 'correction_payload.original must not be blank' })
  @MaxLength(10000)
  original!: string;

  @IsString()
  @Matches(/\S/, { message: 'correction_payload.corrected must not be blank' })
  @MaxLength(10000)
  corrected!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  explanation?: string;
}

export class CorrectionRequestPayloadDto {
  @IsString()
  @Matches(/\S/, {
    message: 'correction_request_payload.original_text must not be blank',
  })
  @MaxLength(10000)
  original_text!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  target_language?: string;
}

export class StatusReplyPayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  status_update_id!: string;

  @IsString()
  @Matches(/\S/, {
    message: 'status_reply_payload.status_text must not be blank',
  })
  @MaxLength(1000)
  status_text!: string;
}

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

  @ValidateIf(
    (dto: SendMessageDto) =>
      MEDIA_MESSAGE_TYPES.includes(
        dto.message_type as (typeof MEDIA_MESSAGE_TYPES)[number],
      ) || dto.media_url !== undefined,
  )
  @IsString()
  @Matches(/\S/, { message: 'media_url must not be blank' })
  @MaxLength(3000000)
  media_url?: string;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.message_type === 'correction' || dto.correction_payload !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => CorrectionPayloadDto)
  correction_payload?: CorrectionPayloadDto;

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
