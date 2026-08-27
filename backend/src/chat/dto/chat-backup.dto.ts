import { IsArray, IsNotEmpty } from 'class-validator';

export class ImportMessagesDto {
  @IsArray()
  @IsNotEmpty()
  messages!: Record<string, unknown>[];
}
