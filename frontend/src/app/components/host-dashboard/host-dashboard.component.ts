import { Component, input, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [CommonModule, AppCardComponent],
  template: `
    <app-card variant="elevated" padding="md" customClass="bg-slate-800 text-white flex flex-row items-center justify-between gap-4 border border-slate-700">
      
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

    </app-card>
  `
})
export class HostDashboardComponent implements OnInit, OnDestroy {
  viewerCount = input<number>(0);
  earnedCoins = input<number>(0);
  startTime = input.required<Date>();

  uptimeSeconds = signal<number>(0);
  private timerRef: ReturnType<typeof setInterval> | undefined;

  uptime = computed(() => {
    const totalSeconds = this.uptimeSeconds();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  });

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
    const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
    this.uptimeSeconds.set(diffSeconds);
  }
}
