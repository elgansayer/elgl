import 'reflect-metadata';
import { IsIn, IsOptional } from 'class-validator';
import { REPORT_PERIODS, type ReportPeriod } from '../performance-report.types';

export class PerformanceReportQueryDto {
  /** Rolling window length: `week` is 7 days, `month` is 30 days. Defaults to `week`. */
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period?: ReportPeriod;
}
