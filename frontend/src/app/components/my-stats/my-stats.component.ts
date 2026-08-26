import { Component, computed, inject, resource } from '@angular/core';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type DayName = (typeof DAY_NAMES)[number];

interface StudyHourDay {
  day: DayName;
  hours: number;
}

interface MyStatsResponse {
  study_hours: StudyHourDay[];
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isStudyHourDay(value: unknown): value is StudyHourDay {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['day'] === 'string' &&
    DAY_NAMES.includes(candidate['day'] as DayName) &&
    typeof candidate['hours'] === 'number' &&
    Number.isFinite(candidate['hours']) &&
    candidate['hours'] >= 0
  );
}

function isMyStatsResponse(value: unknown): value is MyStatsResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const studyHours = candidate['study_hours'];
  if (!Array.isArray(studyHours) || studyHours.length !== DAY_NAMES.length) return false;
  if (!studyHours.every(isStudyHourDay)) return false;

  const returnedDays = new Set(studyHours.map(({ day }) => day));
  if (returnedDays.size !== DAY_NAMES.length) return false;

  return (
    isNonNegativeSafeInteger(candidate['messages_sent']) &&
    isNonNegativeSafeInteger(candidate['corrections_count']) &&
    isNonNegativeSafeInteger(candidate['moments_count'])
  );
}

@Component({
  selector: 'app-my-stats',
  imports: [HlmButton, NgChartsModule, TranslatePipe],
  template: `
    <main
      class="mx-auto max-w-4xl space-y-6 p-4"
      aria-labelledby="my-stats-heading"
      [attr.aria-busy]="statsResource.isLoading()"
    >
      <h1 id="my-stats-heading" class="text-2xl font-bold text-text-primary">
        {{ 'stats.myStats.title' | t }}
      </h1>

      @if (statsResource.isLoading()) {
        <div class="py-12 text-center text-text-secondary" role="status" aria-live="polite">
          {{ 'stats.myStats.loading' | t }}
        </div>
      } @else if (statsResource.error()) {
        <div class="space-y-4 py-12 text-center" role="alert">
          <p class="text-danger">{{ 'stats.myStats.error' | t }}</p>
          <button hlmBtn type="button" variant="outline" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (stats(); as currentStats) {
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section
            class="rounded-2xl border border-surface-100 bg-surface-200 p-5 shadow-sm"
            aria-labelledby="study-hours-heading"
          >
            <h2 id="study-hours-heading" class="mb-4 text-lg font-semibold text-text-primary">
              {{ 'stats.myStats.studyHours' | t }}
            </h2>
            <canvas
              baseChart
              aria-hidden="true"
              [data]="lineChartData()"
              [options]="lineChartOptions"
              [type]="'line'"
            >
            </canvas>
            <ul class="sr-only">
              @for (entry of currentStats.study_hours; track entry.day) {
                <li>
                  {{ 'stats.dayAbbr.' + entry.day.toLowerCase() | t }}:
                  {{ entry.hours }} {{ 'stats.myStats.hours' | t }}
                </li>
              }
            </ul>
          </section>

          <section
            class="rounded-2xl border border-surface-100 bg-surface-200 p-5 shadow-sm"
            aria-labelledby="activity-breakdown-heading"
          >
            <h2
              id="activity-breakdown-heading"
              class="mb-4 text-lg font-semibold text-text-primary"
            >
              {{ 'stats.myStats.activityBreakdown' | t }}
            </h2>
            <canvas
              baseChart
              aria-hidden="true"
              [data]="pieChartData()"
              [options]="pieChartOptions"
              [type]="'pie'"
            >
            </canvas>
          </section>

          <section
            class="rounded-2xl border border-surface-100 bg-surface-200 p-5 shadow-sm md:col-span-2"
            aria-labelledby="stats-summary-heading"
          >
            <h2 id="stats-summary-heading" class="mb-4 text-lg font-semibold text-text-primary">
              {{ 'stats.myStats.summary' | t }}
            </h2>
            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="rounded-xl bg-surface-300 p-4 text-center">
                <dd class="text-3xl font-bold text-secondary">
                  {{ currentStats.messages_sent }}
                </dd>
                <dt class="mt-1 text-sm text-text-secondary">
                  {{ 'stats.myStats.messagesSent' | t }}
                </dt>
              </div>
              <div class="rounded-xl bg-surface-300 p-4 text-center">
                <dd class="text-3xl font-bold text-success">
                  {{ currentStats.corrections_count }}
                </dd>
                <dt class="mt-1 text-sm text-text-secondary">
                  {{ 'stats.myStats.correctionsMade' | t }}
                </dt>
              </div>
              <div class="rounded-xl bg-surface-300 p-4 text-center">
                <dd class="text-3xl font-bold text-warning">
                  {{ currentStats.moments_count }}
                </dd>
                <dt class="mt-1 text-sm text-text-secondary">
                  {{ 'stats.myStats.momentsPosted' | t }}
                </dt>
              </div>
            </dl>
          </section>
        </div>
      }
    </main>
  `,
})
export class MyStatsComponent {
  private readonly authService = inject(AuthService);
  private readonly i18nService = inject(I18nService);

  protected readonly statsResource = resource<MyStatsResponse, unknown>({
    loader: async ({ abortSignal }) => {
      const token = this.authService.getAccessToken();
      if (!token) throw new Error('Stats unavailable');

      const response = await fetch(`${environment.apiUrl}/stats/me`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
        signal: abortSignal,
      });
      if (!response.ok) throw new Error('Stats unavailable');

      const payload: unknown = await response.json();
      if (!isMyStatsResponse(payload)) throw new Error('Stats unavailable');
      return payload;
    },
  });

  protected readonly stats = computed(() => this.statsResource.value() ?? null);

  protected readonly lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const data = this.statsResource.value();
    const labels =
      data?.study_hours.map((stat) =>
        this.i18nService.translate(`stats.dayAbbr.${stat.day.toLowerCase()}`),
      ) ?? DAY_NAMES;
    const hours = data?.study_hours.map((stat) => stat.hours) ?? DAY_NAMES.map(() => 0);

    return {
      labels,
      datasets: [
        {
          data: hours,
          label: this.i18nService.translate('stats.myStats.studyHours'),
          fill: true,
          tension: 0.4,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.2)',
        },
      ],
    };
  });

  protected readonly lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: this.i18nService.translate('stats.myStats.hours'),
        },
      },
    },
  };

  protected readonly pieChartData = computed<ChartConfiguration<'pie'>['data']>(() => {
    const data = this.statsResource.value();
    return {
      labels: [
        this.i18nService.translate('stats.myStats.messagesSent'),
        this.i18nService.translate('stats.myStats.correctionsMade'),
        this.i18nService.translate('stats.myStats.momentsPosted'),
      ],
      datasets: [
        {
          data: [data?.messages_sent ?? 0, data?.corrections_count ?? 0, data?.moments_count ?? 0],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
        },
      ],
    };
  });

  protected readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  protected retry(): void {
    this.statsResource.reload();
  }
}
