import { Component, signal, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitisePipe } from '../../services/sanitise.pipe';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { ModerationService, ModerationItem } from '../../services/moderation.service';

@Component({
  selector: 'app-moderation-queue',
  imports: [DatePipe, TranslatePipe, SanitisePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent, AppCardComponent],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.scss'],
})
export class ModerationQueueComponent {
  private moderationService = inject(ModerationService);

  activeTab = signal<'moment' | 'profile'>('moment');

  momentItems = signal<ModerationItem[]>([]);
  profileItems = signal<ModerationItem[]>([]);

  loadingMoments = signal(true);
  loadingProfiles = signal(true);

  error = signal<string | null>(null);

  private itemsLoader = resource({
    params: () => ({ tab: this.activeTab() }),
    loader: async ({ params }) => {
      this.error.set(null);
      try {
        if (params.tab === 'moment') {
          this.loadingMoments.set(true);
          const items = await this.moderationService.getItems('moment', 'pending');
          this.momentItems.set(items);
          return items;
        } else {
          this.loadingProfiles.set(true);
          const items = await this.moderationService.getItems('profile', 'pending');
          this.profileItems.set(items);
          return items;
        }
      } catch {
        this.error.set(
          params.tab === 'moment'
            ? 'Failed to load flagged moments.'
            : 'Failed to load flagged profiles.'
        );
        return [];
      } finally {
        this.loadingMoments.set(false);
        this.loadingProfiles.set(false);
      }
    },
    defaultValue: [],
  });

  setTab(tab: 'moment' | 'profile'): void {
    this.activeTab.set(tab);
  }

  async approveItem(item: ModerationItem) {
    try {
      await this.moderationService.approveItem(item.id, item.type);
      this.refreshItems(item.type);
    } catch {
      this.error.set(`Failed to approve ${item.type}.`);
    }
  }

  async rejectItem(item: ModerationItem) {
    try {
      await this.moderationService.rejectItem(item.id, item.type, 'Violation');
      this.refreshItems(item.type);
    } catch {
      this.error.set(`Failed to reject ${item.type}.`);
    }
  }

  private refreshItems(type: 'moment' | 'profile') {
    if (type === 'moment') {
      this.momentItems.set([]);
    } else {
      this.profileItems.set([]);
    }
    this.itemsLoader.reload();
  }

  get filteredMoments() {
    return this.momentItems().filter((i) => i.status === 'pending');
  }

  get filteredProfiles() {
    return this.profileItems().filter((i) => i.status === 'pending');
  }

  itemsForTab(): ModerationItem[] {
    return this.activeTab() === 'moment' ? this.filteredMoments : this.filteredProfiles;
  }
}
