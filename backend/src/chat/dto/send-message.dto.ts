import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const MEDIA_MESSAGE_TYPES = [
  'voice',
  'doodle',
  'sticker',
  'view_once_media',
] as const;

const DOODLE_PNG_DATA_URL_PATTERN =
  /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/;

function IsDoodlePngDataUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isDoodlePngDataUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const messageType = (args.object as { message_type?: unknown })
            .message_type;
          if (messageType !== 'doodle') return true;

          return (
            typeof value === 'string' && DOODLE_PNG_DATA_URL_PATTERN.test(value)
          );
        },
      },
    });
  };
}

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
  @MaxLength(128)
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

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.message_type === 'text' || dto.text_content !== undefined,
  )
  @IsString()
  @Matches(/\S/, { message: 'text_content must not be blank' })
  @MaxLength(10000)
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
  @IsDoodlePngDataUrl({
    message: 'doodle media_url must be a PNG data URL produced by the canvas',
  })
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
  @IsNotEmpty()
  @MaxLength(128)
  reply_to_id?: string;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.message_type === 'correction_request' ||
      dto.correction_request_payload !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => CorrectionRequestPayloadDto)
  correction_request_payload?: CorrectionRequestPayloadDto;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.message_type === 'status_reply' ||
      dto.status_reply_payload !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => StatusReplyPayloadDto)
  status_reply_payload?: StatusReplyPayloadDto;
}

export class AiGenerateReplyDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
