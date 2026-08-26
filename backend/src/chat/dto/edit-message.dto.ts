import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  text_content!: string;

  @IsOptional()
  @IsString()
  reply_to_id?: string;
}
