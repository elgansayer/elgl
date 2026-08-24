import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ADMIN_ACTION_REASON_CODES } from '../admin-action-reasons';
import {
  ADMIN_NETWORK_BLOCK_SCOPES,
  AdminNetworkBlockScope,
} from './admin-network-abuse.dto';

export const MAX_PUBLIC_ASN = 4_294_967_295;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdminNetworkProviderLookupDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PUBLIC_ASN)
  asn!: number;
}

export class AdminNetworkProviderImpactDto extends AdminNetworkProviderLookupDto {
  @IsIn(ADMIN_NETWORK_BLOCK_SCOPES)
  scope!: AdminNetworkBlockScope;
}

export class CreateAdminNetworkProviderBlockDto extends AdminNetworkProviderLookupDto {
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

export class CreateAdminNetworkProviderAllowlistDto extends AdminNetworkProviderLookupDto {
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
