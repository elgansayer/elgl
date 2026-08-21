import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AudioRoomTokenDto {
  @ApiProperty({
    description: 'LiveKit room name for which to generate an access token',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}
