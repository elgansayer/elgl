import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_ACTION_REASON_CODES,
  AdminActionReasonCode,
} from '../admin-action-reasons';

export const FLAGGED_MOMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;
export type FlaggedMomentStatus = (typeof FLAGGED_MOMENT_STATUSES)[number];

export const FLAGGED_MOMENT_DECISIONS = ['dismiss', 'uphold'] as const;
export type FlaggedMomentDecision = (typeof FLAGGED_MOMENT_DECISIONS)[number];

export class AdminFlaggedMomentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    enum: FLAGGED_MOMENT_STATUSES,
    default: 'pending',
    description:
      'pending = awaiting review, approved = dismissed (no violation), rejected = upheld (violation confirmed)',
  })
  @IsOptional()
  @IsIn(FLAGGED_MOMENT_STATUSES)
  status?: FlaggedMomentStatus = 'pending';
}

export class ResolveFlaggedMomentDto {
  @ApiProperty({
    enum: FLAGGED_MOMENT_DECISIONS,
    description:
      'dismiss = the Moment does not violate policy; uphold = the violation is confirmed',
  })
  @IsIn(FLAGGED_MOMENT_DECISIONS)
  decision!: FlaggedMomentDecision;

  @ApiProperty({ enum: ADMIN_ACTION_REASON_CODES })
  @IsIn(ADMIN_ACTION_REASON_CODES)
  reasonCode!: AdminActionReasonCode;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Private note kept in the audit trail, never shown to users',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorNote?: string;
}

export class IssueAccountSuspensionDto {
  @ApiProperty({
    description:
      'ISO-8601 end of the suspension. Must be at least one minute and at most 90 days ahead.',
  })
  @IsISO8601({ strict: true })
  expiresAt!: string;

  @ApiProperty({ enum: ADMIN_ACTION_REASON_CODES })
  @IsIn(ADMIN_ACTION_REASON_CODES)
  reasonCode!: AdminActionReasonCode;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorNote?: string;

  @ApiPropertyOptional({
    description:
      'Flagged-Moment report that justifies the suspension; it is upheld when the suspension is recorded',
  })
  @IsOptional()
  @IsUUID()
  reportId?: string;

  @ApiProperty({
    description:
      'Client-generated key. Retrying the same request with the same key never issues a second suspension.',
  })
  @IsUUID()
  idempotencyKey!: string;
}

export class LiftAccountSuspensionDto {
  @ApiProperty({ enum: ADMIN_ACTION_REASON_CODES })
  @IsIn(ADMIN_ACTION_REASON_CODES)
  reasonCode!: AdminActionReasonCode;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorNote?: string;
}
