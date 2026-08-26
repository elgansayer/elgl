import { IsBoolean, IsUUID } from 'class-validator';

export class PublishTypingDto {
  @IsUUID()
  room_id!: string;

  @IsBoolean()
  is_typing!: boolean;
}
