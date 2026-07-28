import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService, VisitorLog, UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-visitor-logs',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './visitor-logs.component.html',
  styleUrls: ['./visitor-logs.component.scss'],
})
export class VisitorLogsComponent implements OnInit {
  private userService = inject(UserService);

  readonly visitors = signal<VisitorLog[]>([]);
  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly hideBlurred = signal<boolean>(false);

  readonly visibleVisitorsCount = computed(
    () => this.visitors().filter((visitor) => !visitor.is_blurred).length,
  );
  readonly blurredVisitorsCount = computed(
    () => this.visitors().filter((visitor) => visitor.is_blurred).length,
  );
  readonly filteredVisitors = computed(() =>
    this.hideBlurred() ? this.visitors().filter((visitor) => !visitor.is_blurred) : this.visitors(),
  );

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [profileData, logs] = await Promise.all([
        this.userService.getMyProfile(),
        this.userService.getMyVisitors(),
      ]);
      this.profile.set(profileData);
      this.visitors.set(logs);
    } catch (e) {
      console.error('Failed to load visitor logs:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleHideBlurred(): void {
    this.hideBlurred.update((value) => !value);
  }
}
