import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAwayMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  awayMessage!: string;
}
