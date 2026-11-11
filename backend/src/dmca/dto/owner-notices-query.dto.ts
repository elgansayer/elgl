import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DMCA_PAGE_SIZE_MAX } from '../dmca.constants';

function toInteger({ value }: { value: unknown }): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return value;
}

export class OwnerNoticesQueryDto {
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
