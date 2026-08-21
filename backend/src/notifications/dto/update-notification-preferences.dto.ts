import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  readonly do_not_disturb?: boolean;

  @IsOptional()
  @IsString()
  readonly quiet_hours_start?: string | null;

  @IsOptional()
  @IsString()
  readonly quiet_hours_end?: string | null;
}
