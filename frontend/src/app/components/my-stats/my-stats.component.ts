import { Component, inject, computed, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TranslatePipe } from '../../services/translate.pipe';
import { StatsService, UserStats } from '../../services/stats.service';

const EMPTY_STATS: UserStats = {
  translations_count: 0,
  corrections_count: 0,
  messages_count: 0,
  moments_count: 0,
};

@Component({
  selector: 'app-my-stats',
  imports: [CommonModule, NgChartsModule, TranslatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text-primary">{{ 'stats.title' | t }}</h1>

      @if (statsData.isLoading()) {
        <p class="text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (statsData.error()) {
        <p class="text-red-500">{{ 'common.loadError' | t }}</p>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'stats.studyHours' | t }}</h2>
            <canvas baseChart [data]="lineChartData()" [options]="lineChartOptions" [type]="'line'">
            </canvas>
          </div>

          <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'stats.activityBreakdown' | t }}</h2>
            <canvas baseChart [data]="pieChartData()" [options]="pieChartOptions" [type]="'pie'">
            </canvas>
          </div>
        </div>
      }
    </div>
  `,
})
export class MyStatsComponent {
  private statsService = inject(StatsService);

  protected statsData = resource({
    loader: async (): Promise<UserStats> => {
      return await this.statsService.getMyStats();
    },
  });

  protected readonly lineChartData = computed((): ChartConfiguration<'line'>['data'] => {
    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          data: [1.5, 2, 1, 3.5, 2.5, 4, 3],
          label: 'Study Hours',
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
  };

  protected readonly pieChartData = computed((): ChartConfiguration<'pie'>['data'] => {
    const s = this.statsData.value() ?? EMPTY_STATS;
    return {
      labels: ['Messages', 'Corrections', 'Moments'],
      datasets: [
        {
          data: [s.messages_count, s.corrections_count, s.moments_count],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
        },
      ],
    };
  });

  protected readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
  };
}
