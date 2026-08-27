import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminAuditQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;

  @ApiPropertyOptional({ description: 'Exact action identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @ApiPropertyOptional({
    enum: ['success', 'denied', 'failed'],
    description: 'Exact audit outcome filter',
  })
  @IsOptional()
  @IsIn(['success', 'denied', 'failed'])
  outcome?: 'success' | 'denied' | 'failed';

  @ApiPropertyOptional({ description: 'Exact capability key filter' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  capabilityKey?: string;

  @ApiPropertyOptional({ description: 'Exact reason code filter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @ApiPropertyOptional({ description: 'Exact actor user ID filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  actorUserId?: string;

  @ApiPropertyOptional({ description: 'Exact target type filter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  targetType?: string;

  @ApiPropertyOptional({ description: 'Exact target identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  targetId?: string;

  @ApiPropertyOptional({ description: 'Exact correlation identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  correlationId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 lower creation-time bound',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 upper creation-time bound',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
