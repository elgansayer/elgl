import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEscrowPaymentDto {
  @IsIn([
    'approve_delivery',
    'raise_dispute',
    'cancel',
    'resolve_dispute',
    'request_refund',
  ])
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
