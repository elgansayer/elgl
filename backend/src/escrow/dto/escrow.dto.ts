import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateEscrowDto {
  @IsUUID()
  @IsNotEmpty()
  payee_id!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  amount_coins!: number;

  @IsString()
  @IsNotEmpty()
  reference_type!: string;

  @IsString()
  @IsNotEmpty()
  reference_id!: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}

export class ReleaseEscrowDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['release', 'refund', 'cancel'])
  action!: 'release' | 'refund' | 'cancel';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EscrowListQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['payer', 'payee'])
  role?: 'payer' | 'payee';

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'held', 'released', 'refunded', 'cancelled', 'disputed'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
