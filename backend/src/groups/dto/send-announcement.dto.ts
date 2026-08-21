import { IsString, IsNotEmpty } from 'class-validator';

export class SendAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
