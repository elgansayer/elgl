import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-my-stats',
  imports: [CommonModule, NgChartsModule, TranslatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text-primary">{{ 'myStats.title' | t }}</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'myStats.studyHoursThisWeek' | t }}</h2>
          <canvas baseChart [data]="lineChartData()" [options]="lineChartOptions" [type]="'line'">
          </canvas>
        </div>

        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">{{ 'myStats.activityBreakdown' | t }}</h2>
          <canvas baseChart [data]="pieChartData()" [options]="pieChartOptions" [type]="'pie'">
          </canvas>
        </div>
      </div>
    </div>
  `,
})
export class MyStatsComponent {
  private i18n = inject(I18nService);

  lineChartData = computed<ChartConfiguration<'line'>['data']>(() => ({
    labels: [
      this.i18n.translate('myStats.mon'),
      this.i18n.translate('myStats.tue'),
      this.i18n.translate('myStats.wed'),
      this.i18n.translate('myStats.thu'),
      this.i18n.translate('myStats.fri'),
      this.i18n.translate('myStats.sat'),
      this.i18n.translate('myStats.sun'),
    ],
    datasets: [
      {
        data: [1.5, 2, 1, 3.5, 2.5, 4, 3],
        label: this.i18n.translate('myStats.studyHours'),
        fill: true,
        tension: 0.4,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.2)',
      },
    ],
  }));

  pieChartData = computed<ChartConfiguration<'pie'>['data']>(() => ({
    labels: [
      this.i18n.translate('myStats.messagesSent'),
      this.i18n.translate('myStats.correctionsMade'),
      this.i18n.translate('myStats.momentsPosted'),
    ],
    datasets: [
      {
        data: [340, 45, 12],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
      },
    ],
  }));

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
  };

  pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
  };
}
