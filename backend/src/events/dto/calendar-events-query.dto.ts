import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CalendarEventsQueryDto {
  @IsISO8601()
  from_date!: string;

  @IsISO8601()
  to_date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 100;
}
