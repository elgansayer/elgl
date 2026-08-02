import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class ReplyToStatusUpdateDto {
  @IsString()
  @IsNotEmpty()
  status_update_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  status_text!: string;

  @IsUUID()
  @IsNotEmpty()
  target_user_id!: string;
}
