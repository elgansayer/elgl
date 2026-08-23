import { IsUUID } from 'class-validator';

export class OpenDirectChatDto {
  @IsUUID('4')
  partnerId!: string;
}
