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

export class AdminRoleAssignmentsQueryDto {
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

  @ApiPropertyOptional({ description: 'Exact target administrator user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  userId?: string;

  @ApiPropertyOptional({ description: 'Exact role key filter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  roleKey?: string;

  @ApiPropertyOptional({ description: 'Exact granting administrator user ID' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  grantedBy?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 lower grant-time bound',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Inclusive ISO-8601 upper grant-time bound',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
