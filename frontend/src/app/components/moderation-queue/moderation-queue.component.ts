import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModerationService, ModerationItem } from '../../services/moderation.service';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.scss'],
})
export class ModerationQueueComponent implements OnInit {
  private moderationService = inject(ModerationService);

  activeTab = signal<'moment' | 'profile'>('moment');

  momentItems = signal<ModerationItem[]>([]);
  profileItems = signal<ModerationItem[]>([]);

  loadingMoments = signal(false);
  loadingProfiles = signal(false);

  error = signal<string | null>(null);

  ngOnInit(): void {
    this.fetchItemsForTab('moment');
  }

  setTab(tab: 'moment' | 'profile'): void {
    this.activeTab.set(tab);
    this.fetchItemsForTab(tab);
  }

  fetchItemsForTab(tab: 'moment' | 'profile') {
    if (tab === 'moment') {
      if (this.momentItems().length > 0) return;
      this.loadingMoments.set(true);
      this.error.set(null);
      this.moderationService.getItems('moment', 'pending')
        .pipe(
          tap((items) => this.momentItems.set(items)),
          catchError(() => {
            this.error.set('Failed to load flagged moments.');
            return of([]);
          }),
          finalize(() => this.loadingMoments.set(false)),
        ).subscribe();
    } else {
      if (this.profileItems().length > 0) return;
      this.loadingProfiles.set(true);
      this.error.set(null);
      this.moderationService.getItems('profile', 'pending')
        .pipe(
          tap((items) => this.profileItems.set(items)),
          catchError(() => {
            this.error.set('Failed to load flagged profiles.');
            return of([]);
          }),
          finalize(() => this.loadingProfiles.set(false)),
        ).subscribe();
    }
  }

  approveItem(item: ModerationItem) {
    const type = item.type;
    this.moderationService.approveItem(item.id, type)
      .pipe(
        finalize(() => this.refreshItems(type)),
      ).subscribe({
        error: () => this.error.set(`Failed to approve ${type}.`),
      });
  }

  rejectItem(item: ModerationItem) {
    const type = item.type;
    this.moderationService.rejectItem(item.id, type, 'Violation')
      .pipe(
        finalize(() => this.refreshItems(type)),
      ).subscribe({
        error: () => this.error.set(`Failed to reject ${type}.`),
      });
  }

  private refreshItems(type: 'moment' | 'profile') {
    if (type === 'moment') {
      this.momentItems.set([]);
      this.fetchItemsForTab('moment');
    } else {
      this.profileItems.set([]);
      this.fetchItemsForTab('profile');
    }
  }

  get filteredMoments() {
    return this.momentItems().filter(i => i.status === 'pending');
  }

  get filteredProfiles() {
    return this.profileItems().filter(i => i.status === 'pending');
  }

  itemsForTab(): ModerationItem[] {
    return this.activeTab() === 'moment'
      ? this.filteredMoments
      : this.filteredProfiles;
  }
}
