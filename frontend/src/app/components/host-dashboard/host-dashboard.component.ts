import { Component, input, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-800 text-white rounded-2xl p-4 shadow-lg flex flex-row items-center justify-between gap-4 border border-slate-700">
      
      <!-- Viewer Count -->
      <div class="flex flex-col items-start">
        <span class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Viewers</span>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span class="text-xl font-bold">{{ viewerCount() }}</span>
        </div>
      </div>

      <!-- Earned Coins -->
      <div class="flex flex-col items-start border-s border-slate-700 ps-4">
        <span class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Coins Earned</span>
        <div class="flex items-center gap-2">
          <span class="text-yellow-400 text-xl">🪙</span>
          <span class="text-xl font-bold text-yellow-400">{{ earnedCoins() }}</span>
        </div>
      </div>

      <!-- Uptime -->
      <div class="flex flex-col items-start border-s border-slate-700 ps-4">
        <span class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Uptime</span>
        <div class="flex items-center gap-2">
          <span class="text-xl font-mono font-bold text-emerald-400">{{ uptime() }}</span>
        </div>
      </div>

    </div>
  `
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  viewerCount = input<number>(0);
  earnedCoins = input<number>(0);
  startTime = input.required<Date>();

  uptime = signal<string>('00:00:00');
  private timerRef: any;

  ngOnInit(): void {
    this.updateUptime();
    this.timerRef = setInterval(() => this.updateUptime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerRef) {
      clearInterval(this.timerRef);
    }
  }

  private updateUptime(): void {
    const now = new Date().getTime();
    const start = this.startTime().getTime();
    const diff = Math.max(0, now - start);

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (num: number) => num.toString().padStart(2, '0');
    this.uptime.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
  }
}
