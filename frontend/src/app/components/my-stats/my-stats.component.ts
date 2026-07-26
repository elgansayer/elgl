import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-my-stats',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="p-4 max-w-4xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold text-text-primary">My Stats</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">Study Hours (This Week)</h2>
          <canvas baseChart
            [data]="lineChartData"
            [options]="lineChartOptions"
            [type]="'line'">
          </canvas>
        </div>
        
        <div class="bg-surface-200 p-5 rounded-2xl shadow-sm border border-surface-100">
          <h2 class="text-lg font-semibold mb-4 text-text-primary">Activity Breakdown</h2>
          <canvas baseChart
            [data]="pieChartData"
            [options]="pieChartOptions"
            [type]="'pie'">
          </canvas>
        </div>
      </div>
    </div>
  `
})
export class MyStatsComponent {
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [1.5, 2, 1, 3.5, 2.5, 4, 3],
        label: 'Study Hours',
        fill: true,
        tension: 0.4,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.2)'
      }
    ]
  };
  
  public lineChartOptions: ChartOptions<'line'> = { 
    responsive: true,
    plugins: {
      legend: { display: false }
    }
  };

  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Messages Sent', 'Corrections Made', 'Moments Posted'],
    datasets: [
      {
        data: [340, 45, 12],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
      }
    ]
  };
  
  public pieChartOptions: ChartOptions<'pie'> = { 
    responsive: true 
  };
}
