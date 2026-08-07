import {
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsOptional,
  Max,
} from 'class-validator';

export class CreateEscrowDto {
  @IsString()
  payee_id!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  amount_coins!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference_id?: string;
}

export class ReleaseEscrowDto {
  @IsString()
  escrow_id!: string;
}

export class RefundEscrowDto {
  @IsString()
  escrow_id!: string;
}
