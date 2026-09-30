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
  readonly loadError = signal<boolean>(false);
  readonly hideBlurred = signal<boolean>(false);

  readonly visibleVisitorsCount = computed(
    () => this.visitors().filter((v) => !v.is_blurred).length,
  );
  readonly blurredVisitorsCount = computed(
    () => this.visitors().filter((v) => v.is_blurred).length,
  );
  readonly filteredVisitors = computed(() =>
    this.hideBlurred() ? this.visitors().filter((v) => !v.is_blurred) : this.visitors(),
  );
  readonly showUpgrade = computed(
    () => this.profile()?.is_vip === false || this.blurredVisitorsCount() > 0,
  );

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      const [profileResult, visitorsResult] = await Promise.allSettled([
        this.userService.getMyProfile(),
        this.userService.getMyVisitors(),
      ]);

      this.profile.set(profileResult.status === 'fulfilled' ? profileResult.value : null);

      if (visitorsResult.status === 'fulfilled') {
        this.visitors.set(visitorsResult.value);
      } else {
        this.visitors.set([]);
        this.loadError.set(true);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleHideBlurred(): void {
    this.hideBlurred.update((value) => !value);
  }
}
