import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsEncryptedChatPayload } from './encrypted-chat-payload.validator';

export class EditMessageDto {
  @IsString()
  @Matches(/\S/, { message: 'text_content must not be blank' })
  @MaxLength(10000)
  text_content!: string;

  /**
   * Retained for backwards compatibility with older clients. Message editing
   * never changes threading; the service intentionally ignores this value.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  reply_to_id?: string;

  @IsOptional()
  @IsBoolean()
  is_encrypted?: boolean;

  @IsEncryptedChatPayload({
    message:
      'encrypted_payload must be a bounded e2ee:v1 envelope when is_encrypted is true and absent otherwise',
  })
  encrypted_payload?: string;
}
