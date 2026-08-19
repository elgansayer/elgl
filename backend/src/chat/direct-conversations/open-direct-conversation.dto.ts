import { IsUUID } from 'class-validator';

export class OpenDirectConversationDto {
  @IsUUID()
  targetUserId!: string;
}
