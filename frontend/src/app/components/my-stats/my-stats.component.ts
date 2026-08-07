import { Component, inject, computed, resource } from '@angular/core';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface MyStatsResponse {
  study_hours: number;
  messages_sent: number;
  corrections_made: number;
  weekly_study_hours: { day: string; hours: number }[];
  activity_breakdown: { label: string; count: number }[];
}

@Component({
  selector: 'app-my-stats',
  imports: [NgChartsModule, TranslatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text-primary">{{ 'myStats.title' | t }}</h1>

      <!-- Summary cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100 flex flex-col items-center justify-center">
          <span class="text-3xl font-bold text-indigo-400">{{ statsResource.value()?.study_hours ?? 0 }}</span>
          <span class="text-sm text-text-secondary mt-2">{{ 'myStats.studyHours' | t }}</span>
        </div>
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100 flex flex-col items-center justify-center">
          <span class="text-3xl font-bold text-blue-400">{{ statsResource.value()?.messages_sent ?? 0 }}</span>
          <span class="text-sm text-text-secondary mt-2">{{ 'myStats.messagesSent' | t }}</span>
        </div>
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100 flex flex-col items-center justify-center">
          <span class="text-3xl font-bold text-emerald-400">{{ statsResource.value()?.corrections_made ?? 0 }}</span>
          <span class="text-sm text-text-secondary mt-2">{{ 'myStats.correctionsMade' | t }}</span>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'myStats.weeklyStudyChart' | t }}</h2>
          @if (lineChartData(); as chartData) {
            <canvas baseChart [data]="chartData" [options]="lineChartOptions" [type]="'line'"></canvas>
          } @else {
            <div class="h-48 flex items-center justify-center text-text-muted">{{ 'myStats.loading' | t }}</div>
          }
        </div>

        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'myStats.activityBreakdown' | t }}</h2>
          @if (pieChartData(); as chartData) {
            <canvas baseChart [data]="chartData" [options]="pieChartOptions" [type]="'pie'"></canvas>
          } @else {
            <div class="h-48 flex items-center justify-center text-text-muted">{{ 'myStats.loading' | t }}</div>
          }
        </div>
      </div>
    </div>
  `,
})
export class MyStatsComponent {
  private readonly authService = inject(AuthService);

  private baseUrl = environment.apiUrl;

  readonly statsResource = resource({
    loader: async (): Promise<MyStatsResponse> => {
      const token = this.authService.getAccessToken();
      if (!token) return {
        study_hours: 0, messages_sent: 0, corrections_made: 0,
        weekly_study_hours: [], activity_breakdown: [],
      };
      const resp = await fetch(`${this.baseUrl}/stats/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        return {
          study_hours: 0, messages_sent: 0, corrections_made: 0,
          weekly_study_hours: [], activity_breakdown: [],
        };
      }
      return resp.json();
    },
  });

  readonly lineChartData = computed<ChartConfiguration<'line'>['data'] | null>(() => {
    const stats = this.statsResource.value();
    if (!stats || !stats.weekly_study_hours.length) return null;
    return {
      labels: stats.weekly_study_hours.map((d) => d.day),
      datasets: [
        {
          data: stats.weekly_study_hours.map((d) => d.hours),
          label: 'Study Hours',
          fill: true,
          tension: 0.4,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.2)',
        },
      ],
    };
  });

  readonly lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: { legend: { display: false } },
  };

  readonly pieChartData = computed<ChartConfiguration<'pie'>['data'] | null>(() => {
    const stats = this.statsResource.value();
    if (!stats || !stats.activity_breakdown.length) return null;
    return {
      labels: stats.activity_breakdown.map((d) => d.label),
      datasets: [
        {
          data: stats.activity_breakdown.map((d) => d.count),
          backgroundColor: ['#3b82f6', '#10b981'],
        },
      ],
    };
  });

  readonly pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
  };
}
