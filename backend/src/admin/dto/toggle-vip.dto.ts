import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleVipDto {
  @IsBoolean()
  is_vip!: boolean;

  @IsOptional()
  @IsString()
  vip_tier?: string;
}
