import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucideMinus } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { environment } from '../../../environments/environment';
import { achievementDescription, achievementName } from '../../achievements/achievement-copy';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

type ReportPeriod = 'week' | 'month';
const REPORT_PERIODS: readonly ReportPeriod[] = ['week', 'month'];

type MetricKey =
  'study_hours' | 'messages_sent' | 'corrections_made' | 'moments_posted' | 'lessons_completed';
const METRIC_KEYS: readonly MetricKey[] = [
  'study_hours',
  'messages_sent',
  'corrections_made',
  'moments_posted',
  'lessons_completed',
];

interface ReportMetric {
  key: MetricKey;
  current: number;
  previous: number;
}

interface ReportBadge {
  code: string;
  name: string;
  description: string;
  unlocked_at: string;
}

interface PerformanceReport {
  period: ReportPeriod;
  metrics: ReportMetric[];
  badges_unlocked: ReportBadge[];
  streak_days: number;
}

type TrendDirection = 'up' | 'down' | 'same';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isMetricKey(value: unknown): value is MetricKey {
  return METRIC_KEYS.some((key) => key === value);
}

function isReportMetric(value: unknown): value is ReportMetric {
  return (
    isRecord(value) &&
    isMetricKey(value['key']) &&
    isNonNegativeNumber(value['current']) &&
    isNonNegativeNumber(value['previous'])
  );
}

function isReportBadge(value: unknown): value is ReportBadge {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['description'] === 'string' &&
    typeof value['unlocked_at'] === 'string' &&
    Number.isFinite(Date.parse(value['unlocked_at']))
  );
}

/** Accepts only a complete report for the period that was asked for. */
function isPerformanceReport(value: unknown, period: ReportPeriod): value is PerformanceReport {
  if (!isRecord(value) || value['period'] !== period) return false;

  const metrics = value['metrics'];
  if (!Array.isArray(metrics) || !metrics.every(isReportMetric)) return false;
  if (
    metrics.length !== METRIC_KEYS.length ||
    new Set(metrics.map((metric) => metric.key)).size !== METRIC_KEYS.length
  ) {
    return false;
  }

  const badges = value['badges_unlocked'];
  if (!Array.isArray(badges) || !badges.every(isReportBadge)) return false;

  const streak = value['streak_days'];
  return typeof streak === 'number' && Number.isSafeInteger(streak) && streak >= 0;
}

@Component({
  selector: 'app-performance-report',
  imports: [DatePipe, HlmButton, NgIcon, TranslatePipe],
  providers: [provideIcons({ lucideArrowDown, lucideArrowUp, lucideMinus })],
  template: `
    <section
      class="rounded-2xl border border-surface-100 bg-surface-200 p-5 shadow-sm"
      aria-labelledby="performance-report-heading"
      [attr.aria-busy]="reportResource.isLoading()"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="performance-report-heading" class="text-lg font-semibold text-text-primary">
          {{ 'stats.report.title' | t }}
        </h2>
        <div
          class="flex flex-wrap gap-2"
          role="group"
          [attr.aria-label]="'stats.report.periodLabel' | t"
        >
          @for (option of periods; track option) {
            <button
              hlmBtn
              size="touch"
              type="button"
              [variant]="period() === option ? 'default' : 'outline'"
              [attr.aria-pressed]="period() === option"
              (click)="selectPeriod(option)"
            >
              {{ 'stats.report.period.' + option | t }}
            </button>
          }
        </div>
      </div>

      @if (reportResource.isLoading()) {
        <div class="py-8 text-center text-text-secondary" role="status" aria-live="polite">
          {{ 'stats.report.loading' | t }}
        </div>
      } @else if (reportResource.error()) {
        <div class="space-y-4 py-8 text-center" role="alert">
          <p class="text-danger-ink">{{ 'stats.report.error' | t }}</p>
          <button hlmBtn size="touch" type="button" variant="outline" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (report(); as current) {
        <p class="mt-2 text-sm text-text-secondary">
          {{ 'stats.report.comparison.' + current.period | t }}
        </p>

        <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (metric of current.metrics; track metric.key) {
            <div class="rounded-xl bg-surface-300 p-4" [attr.data-metric]="metric.key">
              <dt class="text-sm text-text-secondary">
                {{ 'stats.report.metric.' + metric.key | t }}
              </dt>
              <dd class="mt-1 text-2xl font-bold text-text-primary">
                {{ formatNumber(metric.current) }}
              </dd>
              <dd class="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                <ng-icon aria-hidden="true" size="14" [name]="trendIcon(metric)" />
                <span>{{ trendLabel(metric) }}</span>
              </dd>
            </div>
          }
          <div class="rounded-xl bg-surface-300 p-4" data-metric="streak_days">
            <dt class="text-sm text-text-secondary">{{ 'stats.report.streak' | t }}</dt>
            <dd class="mt-1 text-2xl font-bold text-text-primary">
              {{ formatNumber(current.streak_days) }}
            </dd>
          </div>
        </dl>

        <h3 class="mt-6 text-base font-semibold text-text-primary">
          {{ 'stats.report.badgesTitle' | t }}
        </h3>
        @if (current.badges_unlocked.length === 0) {
          <p class="mt-2 text-sm text-text-secondary">{{ 'stats.report.badgesEmpty' | t }}</p>
        } @else {
          <ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
            @for (badge of current.badges_unlocked; track badge.code) {
              <li class="rounded-xl bg-surface-300 p-3">
                <p class="text-sm font-medium text-text-primary">{{ badgeName(badge) }}</p>
                <p class="text-xs text-text-secondary">{{ badgeDescription(badge) }}</p>
                <p class="mt-1 text-xs text-text-secondary">
                  {{
                    'stats.report.unlockedOn'
                      | t: { date: (badge.unlocked_at | date: 'mediumDate') }
                  }}
                </p>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
})
export class PerformanceReportComponent {
  private readonly authService = inject(AuthService);
  private readonly i18n = inject(I18nService);

  protected readonly periods = REPORT_PERIODS;
  protected readonly period = signal<ReportPeriod>('week');

  protected readonly reportResource = resource<PerformanceReport, ReportPeriod>({
    params: () => this.period(),
    loader: async ({ params, abortSignal }) => {
      const token = this.authService.getAccessToken();
      if (!token) throw new Error('Report unavailable');

      const response = await fetch(
        `${environment.apiUrl}/stats/me/report?period=${encodeURIComponent(params)}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
          signal: abortSignal,
        },
      );
      if (!response.ok) throw new Error('Report unavailable');

      const payload: unknown = await response.json();
      if (!isPerformanceReport(payload, params)) throw new Error('Report unavailable');
      return payload;
    },
  });

  protected readonly report = computed(() => this.reportResource.value() ?? null);

  private readonly numberFormat = computed(
    () => new Intl.NumberFormat(this.i18n.currentLang(), { maximumFractionDigits: 1 }),
  );

  protected selectPeriod(period: ReportPeriod): void {
    this.period.set(period);
  }

  protected retry(): void {
    this.reportResource.reload();
  }

  protected formatNumber(value: number): string {
    return this.numberFormat().format(value);
  }

  protected trendIcon(metric: ReportMetric): string {
    const direction = this.trendOf(metric).direction;
    return direction === 'up'
      ? 'lucideArrowUp'
      : direction === 'down'
        ? 'lucideArrowDown'
        : 'lucideMinus';
  }

  protected trendLabel(metric: ReportMetric): string {
    const { direction, change } = this.trendOf(metric);
    return this.i18n.translate(`stats.report.trend.${direction}`, {
      change: this.formatNumber(change),
    });
  }

  protected badgeName(badge: ReportBadge): string {
    return achievementName(this.i18n, badge);
  }

  protected badgeDescription(badge: ReportBadge): string {
    return achievementDescription(this.i18n, badge);
  }

  private trendOf(metric: ReportMetric): { direction: TrendDirection; change: number } {
    const change = Math.round((metric.current - metric.previous) * 10) / 10;
    const direction: TrendDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'same';
    return { direction, change: Math.abs(change) };
  }
}
