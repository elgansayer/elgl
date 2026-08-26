import { Component, computed, inject, resource } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface StudyHourDay {
  day: string;
  hours: number;
}

interface MyStatsResponse {
  study_hours: StudyHourDay[];
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
}

@Component({
  selector: 'app-my-stats',
  imports: [BaseChartDirective, TranslatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text-primary">
        {{ 'stats.myStats.title' | t }}
      </h1>

      @if (statsResource.isLoading()) {
        <div class="text-center py-12 text-text-secondary">
          {{ 'stats.myStats.loading' | t }}
        </div>
      } @else if (statsResource.error()) {
        <div class="text-center py-12 text-danger">
          {{ 'stats.myStats.error' | t }}
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">
              {{ 'stats.myStats.studyHours' | t }}
            </h2>
            <canvas baseChart [data]="lineChartData()" [options]="lineChartOptions" [type]="'line'">
            </canvas>
          </div>

          <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">
              {{ 'stats.myStats.activityBreakdown' | t }}
            </h2>
            <canvas baseChart [data]="pieChartData()" [options]="pieChartOptions" [type]="'pie'">
            </canvas>
          </div>

          <div
            class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100 md:col-span-2"
          >
            <h2 class="text-lg font-semibold mb-4 text-text-primary">
              {{ 'stats.myStats.summary' | t }}
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="bg-surface-300 p-4 rounded-xl text-center">
                <div class="text-3xl font-bold text-secondary">
                  {{ stats()?.messages_sent ?? 0 }}
                </div>
                <div class="text-sm text-text-secondary mt-1">
                  {{ 'stats.myStats.messagesSent' | t }}
                </div>
              </div>
              <div class="bg-surface-300 p-4 rounded-xl text-center">
                <div class="text-3xl font-bold text-success">
                  {{ stats()?.corrections_count ?? 0 }}
                </div>
                <div class="text-sm text-text-secondary mt-1">
                  {{ 'stats.myStats.correctionsMade' | t }}
                </div>
              </div>
              <div class="bg-surface-300 p-4 rounded-xl text-center">
                <div class="text-3xl font-bold text-warning">{{ stats()?.moments_count ?? 0 }}</div>
                <div class="text-sm text-text-secondary mt-1">
                  {{ 'stats.myStats.momentsPosted' | t }}
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MyStatsComponent {
  private readonly authService = inject(AuthService);
  private readonly i18nService = inject(I18nService);

  protected readonly statsResource = resource<MyStatsResponse, unknown>({
    loader: () => {
      const token = this.authService.getAccessToken();
      if (!token) {
        return Promise.reject(new Error('No access token available'));
      }
      return fetch(`${environment.apiUrl}/stats/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch stats');
        return r.json();
      });
    },
  });

  protected readonly stats = computed(() => this.statsResource.value() ?? null);

  protected readonly lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const data = this.statsResource.value();
    const labels = data?.study_hours?.map((s) =>
      this.i18nService.translate(`stats.dayAbbr.${s.day.toLowerCase()}`),
    ) ?? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = data?.study_hours?.map((s) => s.hours) ?? [0, 0, 0, 0, 0, 0, 0];

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
}
