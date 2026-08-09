import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQuickReplyDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  key!: string;
}
