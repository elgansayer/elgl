import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEscrowDto {
  @IsString()
  @MaxLength(255)
  transaction_subject!: string;

  @IsNumber()
  @Min(1)
  amount_cents!: number;

  @IsString()
  currency!: string;

  @IsString()
  recipient_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  milestone_count?: number;
}
