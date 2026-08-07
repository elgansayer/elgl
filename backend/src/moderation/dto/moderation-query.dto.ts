import { IsString, IsIn, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ModerationQueryDto {
  @IsString()
  @IsIn(['moment', 'profile'])
  @IsOptional()
  type?: 'moment' | 'profile';

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  pageSize?: number;
}