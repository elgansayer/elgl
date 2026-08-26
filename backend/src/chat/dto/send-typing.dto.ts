import { IsString } from 'class-validator';

export class SendTypingDto {
  @IsString()
  room_id!: string;

  @IsString()
  is_typing!: string; // Legacy internal DTO; authenticated API uses PublishTypingDto.
}
