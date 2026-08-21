import { IsUUID } from 'class-validator';

export class OpenDirectConversationDto {
  @IsUUID('4')
  target_user_id!: string;
}
