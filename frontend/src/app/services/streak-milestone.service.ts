import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StreakMilestoneService {
  private readonly milestone = signal<number | null>(null);

  readonly milestoneDays = this.milestone.asReadonly();
  readonly visible = computed(() => this.milestone() !== null);

  celebrate(days: number): void {
    this.milestone.set(days);
  }

  clear(): void {
    this.milestone.set(null);
  }
}
