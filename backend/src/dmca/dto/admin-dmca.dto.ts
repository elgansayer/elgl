import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
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
} from '../../admin/admin-action-reasons';
import {
  DMCA_NOTICE_STATUSES,
  DMCA_PAGE_SIZE_MAX,
  DMCA_TARGET_TYPES,
  DmcaNoticeStatus,
  DmcaTargetType,
} from '../dmca.constants';
import { trimOptionalString } from './dmca-dto-transforms';

export const DMCA_OPERATOR_DECISIONS = [
  'disable',
  'reject',
  'withdraw',
  'litigation_hold',
] as const;
export type DmcaOperatorDecision = (typeof DMCA_OPERATOR_DECISIONS)[number];

function toInteger({ value }: { value: unknown }): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return value;
}

export class AdminDmcaListQueryDto {
  @ApiPropertyOptional({ enum: DMCA_NOTICE_STATUSES })
  @IsOptional()
  @IsIn(DMCA_NOTICE_STATUSES)
  status?: DmcaNoticeStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Transform(toInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: DMCA_PAGE_SIZE_MAX })
  @Transform(toInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(DMCA_PAGE_SIZE_MAX)
  pageSize?: number;
}

export class AdminDmcaDecisionDto {
  @ApiProperty({ enum: DMCA_OPERATOR_DECISIONS })
  @IsIn(DMCA_OPERATOR_DECISIONS)
  decision!: DmcaOperatorDecision;

  @ApiPropertyOptional({
    enum: DMCA_TARGET_TYPES,
    description:
      'Required with targetId to disable a notice the system could not locate.',
  })
  @IsOptional()
  @IsIn(DMCA_TARGET_TYPES)
  targetType?: DmcaTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiProperty({ enum: ADMIN_ACTION_REASON_CODES })
  @IsIn(ADMIN_ACTION_REASON_CODES)
  reasonCode!: AdminActionReasonCode;

  @ApiPropertyOptional({
    description: 'Stored in the admin audit log, not on the notice.',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  operatorNote?: string;
}
