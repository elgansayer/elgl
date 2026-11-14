import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Maximum number of messages accepted by one import request. */
export const MAX_IMPORT_MESSAGES = 500;

/**
 * Maximum serialised import body. The global JSON parser already caps request
 * bodies, so this bound gives callers a deterministic 400 before the parser
 * limit turns into a 413.
 */
export const MAX_IMPORT_PAYLOAD_BYTES = 96 * 1024;

/**
 * Fields a backup document may carry. `sender_id` is accepted so an exported
 * document can round-trip, but the service always attributes imported rows to
 * the caller and never trusts the supplied sender.
 */
export class ChatBackupMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  message_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text_content?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  media_url?: string | null;

  @IsOptional()
  @IsObject()
  correction_payload?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sender_id?: string;

  @IsOptional()
  @IsISO8601()
  created_at?: string;
}

export class ImportChatBackupDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_IMPORT_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ChatBackupMessageDto)
  messages!: ChatBackupMessageDto[];
}
