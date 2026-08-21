import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchCallDto {
  @ApiProperty({
    description:
      'The LiveKit room name of the current active call to place on hold',
    example: 'call_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  current_room_name!: string;

  @ApiProperty({
    description: 'The LiveKit room name of the waiting call to switch to',
    example: 'call_f9e8d7c6-b5a4-3210-fedc-ba0987654321',
  })
  @IsString()
  @IsNotEmpty()
  target_room_name!: string;
}
