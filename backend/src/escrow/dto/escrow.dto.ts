import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateEscrowDto {
  @IsUUID()
  partner_id!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  @IsIn(['lesson', 'language_exchange', 'proofreading', 'translation', 'other'])
  service_type?: string;
}

export class ReleaseEscrowDto {
  @IsUUID()
  escrow_id!: string;
}

export class RefundEscrowDto {
  @IsUUID()
  escrow_id!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DisputeEscrowDto {
  @IsUUID()
  escrow_id!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  evidence?: string;
}

export class ResolveDisputeDto {
  @IsUUID()
  escrow_id!: string;

  @IsString()
  @IsIn(['release', 'refund'])
  resolution!: 'release' | 'refund';

  @IsOptional()
  @IsString()
  admin_note?: string;
}
