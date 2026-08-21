import { IsString } from 'class-validator';

export class ConversationStarterDto {
  @IsString()
  partnerId!: string;
}
