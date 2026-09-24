import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';
import { filter, from, interval, startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
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
  // Router component-input binding supplies the room ID after construction.
  // Keep the pre-binding value inert so no empty-room request is issued.
  readonly roomId = input<string>('');

  private readonly service = inject(HostDashboardService);

  private readonly poll = toSignal(
    toObservable(this.roomId).pipe(
      filter((roomId) => roomId.length > 0),
      switchMap((roomId) =>
        interval(10_000).pipe(
          startWith(0),
          switchMap(() => from(this.service.getDashboardStats(roomId))),
        ),
      ),
    ),
    { initialValue: { viewerCount: 0, earnedCoins: 0, startTime: new Date() } },
  );

  readonly viewerCount = computed(() => this.poll().viewerCount);
  readonly earnedCoins = computed(() => this.poll().earnedCoins);
  readonly startTime = computed(() => this.poll().startTime);

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
