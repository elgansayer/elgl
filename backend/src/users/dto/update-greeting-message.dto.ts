import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateGreetingMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  greetingMessage!: string;
}
