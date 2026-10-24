import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlaySoundDto {
  @ApiProperty({
    description: 'ID of the audio room',
    example: 'room_a1b2c3d4',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  room_id!: string;

  @ApiProperty({
    description: 'ID of the soundboard sound to play',
    example: 'applause',
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sound_id!: string;
}
