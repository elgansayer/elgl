import { IsString } from 'class-validator';

export class SendTypingDto {
  @IsString()
  room_id!: string;

  @IsString()
  is_typing!: string; // 'true' or 'false'
}
