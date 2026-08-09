import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleVipDto {
  @ApiProperty({
    description: 'Whether the user should have VIP status',
    example: true,
  })
  @IsBoolean()
  is_vip!: boolean;

  @ApiPropertyOptional({
    description:
      'VIP tier level (e.g., "gold", "platinum"). Set to "free" when is_vip is false',
    example: 'gold',
  })
  @IsOptional()
  @IsString()
  vip_tier?: string;
}
