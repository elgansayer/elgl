import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddFavouriteDto {
  @IsUUID()
  @IsNotEmpty()
  message_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note_text?: string;
}
