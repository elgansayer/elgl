import { IsString, IsNotEmpty } from 'class-validator';

export class SwitchCallDto {
  @IsString()
  @IsNotEmpty()
  current_room_name!: string;

  @IsString()
  @IsNotEmpty()
  target_room_name!: string;
}
