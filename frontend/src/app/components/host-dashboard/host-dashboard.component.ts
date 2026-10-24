import { Component, input, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';
import { interval, from, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { HostDashboardService } from '../../services/host-dashboard.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-host-dashboard',
  imports: [CommonModule, AppCardComponent, TranslatePipe],
  template: `
    <app-card
      role="region"
      [attr.aria-label]="'host_dashboard.cardLabel' | t"
      variant="elevated"
      padding="md"
      customClass="text-text-primary flex flex-row items-center justify-between gap-4"
    >
      <!-- Viewer Count -->
      <div class="flex flex-col items-start">
        <span class="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">{{
          'host_dashboard.viewer_count' | t
        }}</span>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-danger animate-pulse" aria-hidden="true"></div>
          <span class="text-xl font-bold">{{ viewerCount() }}</span>
        </div>
      </div>

      <!-- Earned Coins -->
      <div class="flex flex-col items-start border-s border-surface-100 ps-4">
        <span class="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">{{
          'host_dashboard.coins_earned' | t
        }}</span>
        <div class="flex items-center gap-2">
          <span class="text-vip text-xl" aria-hidden="true">{{
            'host_dashboard.coinIcon' | t
          }}</span>
          <span class="text-xl font-bold text-vip">{{ earnedCoins() }}</span>
        </div>
      </div>

      <!-- Uptime -->
      <div class="flex flex-col items-start border-s border-surface-100 ps-4">
        <span class="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">{{
          'host_dashboard.uptime' | t
        }}</span>
        <div class="flex items-center gap-2">
          <span class="text-xl font-mono font-bold text-success">{{ uptime() }}</span>
        </div>
      </div>
    </app-card>
  `,
})
export class HostDashboardComponent {
  // Allow parent to override stats, otherwise component auto-fetches.
  readonly roomId = input<string>('');
  readonly viewerCount = signal<number>(0);
  readonly earnedCoins = signal<number>(0);
  readonly startTime = signal<Date>(new Date());

  private readonly service = inject(HostDashboardService);

  private readonly poll = toSignal(
    interval(10_000).pipe(
      startWith(0),
      switchMap(() => from(this.service.getDashboardStats(this.roomId()))),
    ),
    { initialValue: { viewerCount: 0, earnedCoins: 0, startTime: new Date() } },
  );

  constructor() {
    effect(() => {
      const stats = this.poll();
      if (!stats) return;
      this.viewerCount.set(stats.viewerCount);
      this.earnedCoins.set(stats.earnedCoins);
      this.startTime.set(stats.startTime);
    });
  }

  private readonly tick = toSignal(interval(1000), { initialValue: 0 });

  readonly uptime = computed(() => {
    this.tick();
    const now = Date.now();
    const start = this.startTime().getTime();
    const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  });
}
