import { IsNotEmpty, IsString } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  text_content!: string;
}
