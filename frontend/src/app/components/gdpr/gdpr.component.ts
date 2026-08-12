import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { GdprService } from '../../services/gdpr.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-gdpr',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="app-screen bg-surface-50">
      <header class="app-header">
        <button (click)="goBack()" class="app-button-icon" [attr.aria-label]="'common.back' | t">
          <span class="text-xl">&larr;</span>
        </button>
        <h1 class="app-header-title">{{ 'gdpr.title' | t }}</h1>
        <div class="w-10"></div>
      </header>

      <main class="ps-4 pe-4 pt-4 pb-4 space-y-6 max-w-lg mx-auto">
        <p class="text-sm text-text-secondary">{{ 'gdpr.description' | t }}</p>

        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'gdpr.archiveSection' | t }}
          </h2>
          <div
            class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm p-4 space-y-3"
          >
            <p class="text-xs text-text-secondary">{{ 'gdpr.archiveInfo' | t }}</p>
            <button
              (click)="requestArchive()"
              [disabled]="loading()"
              class="w-full bg-primary text-on-fill py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              [attr.aria-label]="'gdpr.requestArchiveBtn' | t"
            >
              {{ loading() ? ('common.loading' | t) : ('gdpr.requestArchiveBtn' | t) }}
            </button>
            @if (archiveSuccess()) {
              <p class="text-xs text-success">{{ 'gdpr.archiveSuccess' | t }}</p>
            }
            @if (archiveError()) {
              <p class="text-xs text-danger">{{ archiveError() }}</p>
            }
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'gdpr.deleteSection' | t }}
          </h2>
          <div
            class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm p-4 space-y-3"
          >
            <p class="text-xs text-text-secondary">{{ 'gdpr.deleteInfo' | t }}</p>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                [checked]="confirmDelete()"
                (change)="confirmDelete.set(!confirmDelete())"
                class="h-5 w-5 rounded border-surface-300 text-danger focus:ring-danger/30"
              />
              <span class="text-sm text-text-primary">{{ 'gdpr.deleteConfirmLabel' | t }}</span>
            </label>
            <button
              (click)="deleteAccount()"
              [disabled]="!confirmDelete() || deleting()"
              class="w-full bg-danger text-on-fill py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              [attr.aria-label]="'gdpr.deleteAccountBtn' | t"
            >
              {{ deleting() ? ('common.loading' | t) : ('gdpr.deleteAccountBtn' | t) }}
            </button>
            @if (deleteSuccess()) {
              <p class="text-xs text-success">{{ 'gdpr.deleteSuccess' | t }}</p>
            }
            @if (deleteError()) {
              <p class="text-xs text-danger">{{ deleteError() }}</p>
            }
          </div>
        </section>

        @if (isPendingDeletion()) {
          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'gdpr.cancelDeletionSection' | t }}
            </h2>
            <div class="rounded-2xl bg-warning/10 border border-warning/30 shadow-sm p-4 space-y-3">
              <p class="text-xs text-warning">{{ 'gdpr.cancelDeletionInfo' | t }}</p>
              <button
                (click)="cancelDeletion()"
                [disabled]="cancelling()"
                class="w-full bg-warning text-on-fill py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                [attr.aria-label]="'gdpr.cancelDeletionBtn' | t"
              >
                {{ cancelling() ? ('common.loading' | t) : ('gdpr.cancelDeletionBtn' | t) }}
              </button>
              @if (cancelSuccess()) {
                <p class="text-xs text-success">{{ 'gdpr.cancelDeletionSuccess' | t }}</p>
              }
              @if (cancelError()) {
                <p class="text-xs text-danger">{{ cancelError() }}</p>
              }
            </div>
          </section>
        }
      </main>
    </div>
  `,
})
export class GdprComponent {
  private gdprService = inject(GdprService);
  private i18n = inject(I18nService);

  loading = signal(false);
  archiveSuccess = signal(false);
  archiveError = signal('');

  confirmDelete = signal(false);
  deleting = signal(false);
  deleteSuccess = signal(false);
  deleteError = signal('');

  isPendingDeletion = signal(false);
  cancelling = signal(false);
  cancelSuccess = signal(false);
  cancelError = signal('');

  goBack(): void {
    window.history.back();
  }

  async requestArchive(): Promise<void> {
    this.loading.set(true);
    this.archiveSuccess.set(false);
    this.archiveError.set('');
    try {
      await this.gdprService.requestArchive();
      this.archiveSuccess.set(true);
    } catch {
      this.archiveError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  async deleteAccount(): Promise<void> {
    if (!this.confirmDelete()) return;
    this.deleting.set(true);
    this.deleteSuccess.set(false);
    this.deleteError.set('');
    try {
      await this.gdprService.deleteAccount(true);
      this.deleteSuccess.set(true);
      this.isPendingDeletion.set(true);
    } catch {
      this.deleteError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.deleting.set(false);
    }
  }

  async cancelDeletion(): Promise<void> {
    this.cancelling.set(true);
    this.cancelSuccess.set(false);
    this.cancelError.set('');
    try {
      await this.gdprService.cancelDeletion();
      this.cancelSuccess.set(true);
      this.isPendingDeletion.set(false);
    } catch {
      this.cancelError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.cancelling.set(false);
    }
  }
}
