import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ReplyToStatusUpdateDto {
  @IsString()
  @IsNotEmpty()
  status_update_id!: string;

  @IsString()
  @IsNotEmpty()
  status_text!: string;

  @IsUUID()
  @IsNotEmpty()
  target_user_id!: string;
}
