import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { ADMIN_ACTION_REASON_CODES } from '../admin-action-reasons';

export const ADMIN_NETWORK_BLOCK_SCOPES = ['all', 'auth', 'write'] as const;
export type AdminNetworkBlockScope =
  (typeof ADMIN_NETWORK_BLOCK_SCOPES)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdminNetworkLookupDto {
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  ip!: string;
}

export class AdminNetworkImpactDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  cidr!: string;

  @IsIn(ADMIN_NETWORK_BLOCK_SCOPES)
  scope!: AdminNetworkBlockScope;
}

export class CreateAdminNetworkBlockDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  cidr!: string;

  @IsIn(ADMIN_NETWORK_BLOCK_SCOPES)
  scope!: AdminNetworkBlockScope;

  @IsIn(ADMIN_ACTION_REASON_CODES)
  reasonCode!: (typeof ADMIN_ACTION_REASON_CODES)[number];

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorNote?: string;

  @IsISO8601({ strict: true })
  expiresAt!: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class CreateAdminNetworkAllowlistDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  cidr!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 240)
  reason!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @IsUUID()
  idempotencyKey!: string;
}
