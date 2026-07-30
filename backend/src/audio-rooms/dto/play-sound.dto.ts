import { IsString, IsNotEmpty } from 'class-validator';

export class PlaySoundDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsString()
  @IsNotEmpty()
  sound_id!: string;
}
