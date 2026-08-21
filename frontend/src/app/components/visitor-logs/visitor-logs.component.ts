import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService, VisitorLog, UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-visitor-logs',
  imports: [HlmButton, DatePipe, RouterLink, TranslatePipe],
  templateUrl: './visitor-logs.component.html',
  styleUrls: ['./visitor-logs.component.scss'],
})
export class VisitorLogsComponent {
  private userService = inject(UserService);

  readonly visitors = signal<VisitorLog[]>([]);
  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly hideBlurred = signal<boolean>(false);

  readonly isFreeTier = computed(() => {
    const p = this.profile();
    return !p || p.is_vip === false;
  });

  readonly visibleVisitorsCount = computed(
    () => this.visitors().filter((v) => !v.is_blurred).length,
  );
  readonly blurredVisitorsCount = computed(
    () => this.visitors().filter((v) => v.is_blurred).length,
  );
  readonly filteredVisitors = computed(() =>
    this.hideBlurred() ? this.visitors().filter((v) => !v.is_blurred) : this.visitors(),
  );

  constructor() {
    this.loadData();
  }

  shouldBlur(log: VisitorLog): boolean {
    return this.isFreeTier() || log.is_blurred;
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [profileData, logs] = await Promise.all([
        this.userService.getMyProfile(),
        this.userService.getMyVisitors(),
      ]);
      this.profile.set(profileData);
      this.visitors.set(logs);
    } catch {
      // Silently handle - data may not be available yet
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleHideBlurred(): void {
    this.hideBlurred.update((value) => !value);
  }
}
