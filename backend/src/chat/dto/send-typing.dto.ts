import { Transform } from 'class-transformer';
import { IsBoolean, IsUUID } from 'class-validator';

export class SendTypingDto {
  @IsUUID()
  room_id!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_typing!: boolean;
}
