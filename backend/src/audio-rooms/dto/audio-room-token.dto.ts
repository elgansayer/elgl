import { IsString, IsNotEmpty } from 'class-validator';

export class AudioRoomTokenDto {
  @IsString()
  @IsNotEmpty()
  room_name!: string;
}
