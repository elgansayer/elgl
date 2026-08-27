import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendReactionDto {
  @ApiProperty({
    description: 'ID of the emoji/reaction to send',
    example: 'emoji_heart_eyes',
  })
  @IsString()
  @IsNotEmpty()
  emojiId!: string;
}
