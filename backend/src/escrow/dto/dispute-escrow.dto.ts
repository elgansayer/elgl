import { IsString, IsOptional, MaxLength } from 'class-validator';

export class DisputeEscrowDto {
  @IsString()
  escrow_id!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  evidence_description?: string;
}
