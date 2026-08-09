import { IsOptional, IsBoolean, IsString, Matches } from 'class-validator';

export class DoNotDisturbDto {
  @IsOptional()
  @IsBoolean()
  do_not_disturb?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'quiet_hours_start must be in HH:mm format',
  })
  quiet_hours_start?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'quiet_hours_end must be in HH:mm format',
  })
  quiet_hours_end?: string;
}
