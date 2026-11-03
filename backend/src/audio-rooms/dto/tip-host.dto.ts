import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TipHostDto {
  @ApiProperty({
    description: 'ID of the audio room where the host is being tipped',
    example: '63eedbd6-03f9-433f-a481-98227dfd62af',
  })
  @IsUUID('4')
  room_id!: string;

  @ApiProperty({
    description: 'Amount of coins to tip the host (minimum 1)',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount_coins!: number;

  @ApiPropertyOptional({
    description:
      'Stable UUID reused when retrying the same tip after an ambiguous network or delivery failure',
    example: '7a28776a-93f9-4c0e-b1bc-d47d02a9ca12',
  })
  @IsOptional()
  @IsUUID()
  idempotency_key?: string;
}
