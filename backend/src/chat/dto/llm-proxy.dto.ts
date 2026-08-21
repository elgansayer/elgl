import { IsString, IsNotEmpty } from 'class-validator';

export class LlmProxyDto {
  @IsString()
  @IsNotEmpty()
  messageText!: string;
}
