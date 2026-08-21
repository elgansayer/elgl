import { IsString, IsInt, Min, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateEscrowPaymentDto {
  @IsString()
  @IsNotEmpty()
  payee_id!: string;

  @IsInt()
  @Min(1)
  amount_coins!: number;

  @IsString()
  @MaxLength(500)
  description!: string;
}
