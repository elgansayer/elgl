import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminReportsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Exact report identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reportId?: string;

  @ApiPropertyOptional({ description: 'Exact report status filter' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ description: 'Exact report reason-category filter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCategory?: string;

  @ApiPropertyOptional({ description: 'Exact reported user identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reportedUserId?: string;

  @ApiPropertyOptional({ description: 'Exact reporter user identifier filter' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reporterUserId?: string;

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
