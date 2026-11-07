import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimToUndefined } from '../../safety/dto/safety.dto';
import {
  SAFETY_REPORT_CATEGORY_VALUES,
  SAFETY_REPORT_DESCRIPTION_MAX_LENGTH,
  type SafetyReportCategory,
} from '../../safety/safety.constants';

/**
 * Legacy camelCase wire format for `POST /moderation/report`. It is validated
 * with the same rules as `POST /safety/report` because both routes write to
 * the same `reports` table through `SafetyService`.
 */
export class ReportUserDto {
  @ApiProperty({
    description: 'UUID of the personal or business account being reported',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  reportedUserId!: string;

  @ApiProperty({
    description: 'Reason category for the report',
    enum: SAFETY_REPORT_CATEGORY_VALUES,
    example: 'harassment',
  })
  @IsIn(SAFETY_REPORT_CATEGORY_VALUES)
  reasonCategory!: SafetyReportCategory;

  @ApiPropertyOptional({
    description: 'Optional detailed description of the report',
    maxLength: SAFETY_REPORT_DESCRIPTION_MAX_LENGTH,
    example: 'User sent unsolicited messages with offensive content.',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(SAFETY_REPORT_DESCRIPTION_MAX_LENGTH)
  description?: string;
}
