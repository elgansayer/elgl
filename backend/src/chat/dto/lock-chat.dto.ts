import { IsString, IsNotEmpty } from 'class-validator';

export class LockChatDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class UnlockChatDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}
