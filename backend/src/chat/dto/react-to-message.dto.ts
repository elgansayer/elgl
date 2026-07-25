import { IsNotEmpty, IsString } from 'class-validator';

export class ReactToMessageDto {
  @IsString()
  @IsNotEmpty()
  emoji!: string;
}
