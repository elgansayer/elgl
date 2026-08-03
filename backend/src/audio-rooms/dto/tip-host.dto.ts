import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class TipHostDto {
  @IsString()
  @IsNotEmpty()
  room_id!: string;

  @IsInt()
  @Min(1)
  amount_coins!: number;
}
