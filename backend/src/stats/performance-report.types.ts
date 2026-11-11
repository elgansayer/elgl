import type { UnlockedAchievementDto } from '../achievements/dto/unlocked-achievement.dto';

export const REPORT_PERIODS = ['week', 'month'] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_METRIC_KEYS = [
  'study_hours',
  'messages_sent',
  'corrections_made',
  'moments_posted',
  'lessons_completed',
] as const;

export type ReportMetricKey = (typeof REPORT_METRIC_KEYS)[number];

export interface PerformanceReportMetric {
  key: ReportMetricKey;
  current: number;
  previous: number;
}

export interface PerformanceReportWindow {
  /** Inclusive ISO-8601 instant. */
  start: string;
  /** Exclusive ISO-8601 instant. */
  end: string;
}

export interface PerformanceReportResponse {
  period: ReportPeriod;
  window: PerformanceReportWindow;
  previous_window: PerformanceReportWindow;
  metrics: PerformanceReportMetric[];
  badges_unlocked: UnlockedAchievementDto[];
  streak_days: number;
}
