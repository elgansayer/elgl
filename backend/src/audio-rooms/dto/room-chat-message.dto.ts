import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendRoomChatMessageDto {
  @ApiProperty({
    description: 'Client-generated retry key for idempotent message delivery',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  @IsUUID('4')
  client_message_id!: string;

  @ApiProperty({
    description: 'Plain-text live-room message',
    example: 'Could you explain that phrase again?',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/u, { message: 'text_content must not be blank' })
  @MaxLength(1000)
  text_content!: string;
}

export class ListRoomChatMessagesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset = 0;
}
