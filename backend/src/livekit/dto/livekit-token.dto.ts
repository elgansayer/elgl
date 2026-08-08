import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LivekitTokenDto {
  @ApiProperty({
    description: 'LiveKit room name to join',
    example: 'video_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  room_name!: string;

  @ApiProperty({
    description: 'User identity for the LiveKit participant',
    example: 'user_abc123',
  })
  @IsString()
  @IsNotEmpty()
  participant_identity!: string;
}
