import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlaySoundDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'ID of the soundboard sound to play',
    example: 'applause',
  })
  @IsString()
  @IsNotEmpty()
  sound_id!: string;
}
