import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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
}
