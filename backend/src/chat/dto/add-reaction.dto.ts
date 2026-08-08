import { IsNotEmpty, IsString } from 'class-validator';

export class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji!: string;
}