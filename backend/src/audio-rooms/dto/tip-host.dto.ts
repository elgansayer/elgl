import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TipHostDto {
  @ApiProperty({
    description: 'ID of the audio room where the host is being tipped',
    example: 'room_a1b2c3d4',
  })
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @ApiProperty({
    description: 'Amount of coins to tip the host (minimum 1)',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount_coins!: number;
}
