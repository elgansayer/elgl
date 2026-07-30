import { IsString, IsNotEmpty } from 'class-validator';

export class SendReactionDto {
  @IsString()
  @IsNotEmpty()
  emojiId!: string;
}
