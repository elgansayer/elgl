import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  SAFETY_REPORT_CATEGORY_VALUES,
  SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH,
  SAFETY_REPORT_CONTEXT_URL_PATTERN,
  SAFETY_REPORT_DESCRIPTION_MAX_LENGTH,
  type SafetyReportCategory,
} from '../safety.constants';

/** Trims free text and treats a blank value as "not supplied". */
export const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Report against a person or business account. Business profiles are columns on
 * the same `users` record, so one target identifier covers both.
 */
export class ReportUserDto {
  @IsUUID()
  reported_id!: string;

  @IsIn(SAFETY_REPORT_CATEGORY_VALUES)
  reason_category!: SafetyReportCategory;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(SAFETY_REPORT_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(SAFETY_REPORT_CONTEXT_URL_MAX_LENGTH)
  @Matches(SAFETY_REPORT_CONTEXT_URL_PATTERN, {
    message: 'context_url must be an http(s) link or an app-relative path',
  })
  context_url?: string;
}

export class BlockUserDto {
  @IsUUID()
  blocked_id!: string;
}

export class UnblockUserDto {
  @IsUUID()
  blocked_id!: string;
}

export class SilenceUnknownCallersDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  silence!: boolean;
}
