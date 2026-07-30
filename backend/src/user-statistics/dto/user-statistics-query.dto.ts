import { IsOptional, IsDateString } from 'class-validator';

export class UserStatisticsQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
