import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateGroupSettingsDto {
  @IsOptional()
  @IsBoolean()
  can_send_messages?: boolean;

  @IsOptional()
  @IsBoolean()
  can_edit_info?: boolean;
}
