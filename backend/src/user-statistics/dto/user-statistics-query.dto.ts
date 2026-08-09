import { IsOptional, IsDateString } from 'class-validator';
import 'reflect-metadata';

export class UserStatisticsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
