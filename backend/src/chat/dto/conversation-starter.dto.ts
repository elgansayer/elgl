import { IsUUID } from 'class-validator';

export class ConversationStarterDto {
  @IsUUID()
  partnerId!: string;
}
