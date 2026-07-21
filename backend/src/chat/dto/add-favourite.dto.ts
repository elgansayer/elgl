import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddFavouriteDto {
  @IsUUID()
  @IsNotEmpty()
  message_id!: string;

  @IsOptional()
  @IsString()
  note_text?: string;
}
