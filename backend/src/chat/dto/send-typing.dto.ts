import { IsBoolean, IsUUID } from 'class-validator';

export class SendTypingDto {
  @IsUUID()
  room_id!: string;

  @IsBoolean()
  is_typing!: boolean;
}
