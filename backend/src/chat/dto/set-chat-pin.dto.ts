import { IsBoolean } from 'class-validator';

export class SetChatPinDto {
  @IsBoolean()
  is_pinned!: boolean;
}
