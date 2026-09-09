import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { GdprService } from '../../services/gdpr.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-gdpr',
  standalone: true,
  imports: [HlmCheckbox, TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="app-screen bg-surface-50">
      <header class="app-header">
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="icon-touch"
          (click)="goBack()"
          [attr.aria-label]="'common.back' | t"
        >
          <span class="text-xl" aria-hidden="true">&larr;</span>
        </button>
        <h1 class="app-header-title">{{ 'gdpr.title' | t }}</h1>
        <div class="w-10"></div>
      </header>

      <main class="mx-auto max-w-lg space-y-6 ps-4 pe-4 pt-4 pb-4">
        <p class="text-sm text-text-secondary">{{ 'gdpr.description' | t }}</p>
        @if (statusLoadError()) {
          <p class="text-xs text-danger" role="alert">{{ 'common.loadError' | t }}</p>
        }

        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-text-secondary">
            {{ 'gdpr.archiveSection' | t }}
          </h2>
          <div
            class="space-y-3 overflow-hidden rounded-2xl border border-surface-200 bg-surface-100 p-4 shadow-sm"
          >
            <p class="text-xs text-text-secondary">{{ 'gdpr.archiveInfo' | t }}</p>
            <button
              hlmBtn
              type="button"
              size="touch"
              class="w-full"
              (click)="requestArchive()"
              [disabled]="loading()"
              [attr.aria-busy]="loading()"
              [attr.aria-label]="'gdpr.requestArchiveBtn' | t"
            >
              {{ loading() ? ('common.loading' | t) : ('gdpr.requestArchiveBtn' | t) }}
            </button>
            @if (archiveDownloadUrl()) {
              <button
                hlmBtn
                type="button"
                variant="secondary"
                size="touch"
                class="w-full"
                (click)="downloadLatestArchive()"
              >
                {{ 'privacy.hub.downloadData' | t }}
              </button>
            }
            @if (archiveSuccess()) {
              <p class="text-xs text-success" role="status">{{ 'gdpr.archiveSuccess' | t }}</p>
            }
            @if (archiveError()) {
              <p class="text-xs text-danger" role="alert">{{ archiveError() }}</p>
            }
          </div>
        </section>

        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase tracking-wider text-text-secondary">
            {{ 'gdpr.deleteSection' | t }}
          </h2>
          <div
            class="space-y-3 overflow-hidden rounded-2xl border border-surface-200 bg-surface-100 p-4 shadow-sm"
          >
            <p class="text-xs text-text-secondary">{{ 'gdpr.deleteInfo' | t }}</p>
            <label class="flex cursor-pointer items-center gap-2">
              <hlm-checkbox
                [checked]="confirmDelete()"
                (change)="confirmDelete.set(!confirmDelete())"
                class="h-5 w-5 rounded border-surface-300 text-danger"
              />
              <span class="text-sm text-text-primary">{{ 'gdpr.deleteConfirmLabel' | t }}</span>
            </label>
            <button
              hlmBtn
              type="button"
              variant="destructive-solid"
              size="touch"
              class="w-full"
              (click)="deleteAccount()"
              [disabled]="!confirmDelete() || deleting()"
              [attr.aria-busy]="deleting()"
              [attr.aria-label]="'gdpr.deleteAccountBtn' | t"
            >
              {{ deleting() ? ('common.loading' | t) : ('gdpr.deleteAccountBtn' | t) }}
            </button>
            @if (deleteSuccess()) {
              <p class="text-xs text-success" role="status">{{ 'gdpr.deleteSuccess' | t }}</p>
            }
            @if (deleteError()) {
              <p class="text-xs text-danger" role="alert">{{ deleteError() }}</p>
            }
          </div>
        </section>

        @if (isPendingDeletion()) {
          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase tracking-wider text-text-secondary">
              {{ 'gdpr.cancelDeletionSection' | t }}
            </h2>
            <div class="space-y-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 shadow-sm">
              <p class="text-xs text-warning">{{ 'gdpr.cancelDeletionInfo' | t }}</p>
              <button
                hlmBtn
                type="button"
                variant="secondary"
                size="touch"
                class="w-full border-warning/30 text-warning"
                (click)="cancelDeletion()"
                [disabled]="cancelling()"
                [attr.aria-busy]="cancelling()"
                [attr.aria-label]="'gdpr.cancelDeletionBtn' | t"
              >
                {{ cancelling() ? ('common.loading' | t) : ('gdpr.cancelDeletionBtn' | t) }}
              </button>
              @if (cancelSuccess()) {
                <p class="text-xs text-success" role="status">
                  {{ 'gdpr.cancelDeletionSuccess' | t }}
                </p>
              }
              @if (cancelError()) {
                <p class="text-xs text-danger" role="alert">{{ cancelError() }}</p>
              }
            </div>
          </section>
        }
      </main>
    </div>
  `,
})
export class GdprComponent {
  private readonly gdprService = inject(GdprService);
  private readonly i18n = inject(I18nService);

  readonly statusLoadError = signal(false);
  readonly privacyStatusResource = resource({
    loader: async () => {
      this.statusLoadError.set(false);
      try {
        return await this.gdprService.getStatus();
      } catch {
        this.statusLoadError.set(true);
        return undefined;
      }
    },
  });
  private readonly deletionPendingOverride = signal<boolean | null>(null);
  private readonly archiveDownloadOverride = signal<string | null>(null);

  readonly isPendingDeletion = computed(
    () =>
      this.deletionPendingOverride() ??
      this.privacyStatusResource.value()?.is_deletion_pending ??
      false,
  );
  readonly archiveDownloadUrl = computed(
    () =>
      this.archiveDownloadOverride() ??
      this.privacyStatusResource.value()?.latest_archive?.download_url ??
      '',
  );

  loading = signal(false);
  archiveSuccess = signal(false);
  archiveError = signal('');

  confirmDelete = signal(false);
  deleting = signal(false);
  deleteSuccess = signal(false);
  deleteError = signal('');

  cancelling = signal(false);
  cancelSuccess = signal(false);
  cancelError = signal('');

  goBack(): void {
    window.history.back();
  }

  async requestArchive(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.archiveSuccess.set(false);
    this.archiveError.set('');
    try {
      const archive = await this.gdprService.requestArchive();
      if (archive.status === 'ready') {
        if (!archive.download_url) throw new Error('Missing archive URL');
        this.downloadArchive(archive.download_url);
        this.archiveDownloadOverride.set(archive.download_url);
      } else {
        this.privacyStatusResource.reload();
      }
      this.archiveSuccess.set(true);
    } catch {
      this.archiveError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  async deleteAccount(): Promise<void> {
    if (!this.confirmDelete() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteSuccess.set(false);
    this.deleteError.set('');
    try {
      await this.gdprService.deleteAccount(true);
      this.deleteSuccess.set(true);
      this.deletionPendingOverride.set(true);
    } catch {
      this.deleteError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.deleting.set(false);
    }
  }

  async cancelDeletion(): Promise<void> {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.cancelSuccess.set(false);
    this.cancelError.set('');
    try {
      await this.gdprService.cancelDeletion();
      this.cancelSuccess.set(true);
      this.deletionPendingOverride.set(false);
    } catch {
      this.cancelError.set(this.i18n.translate('common.loadError'));
    } finally {
      this.cancelling.set(false);
    }
  }

  downloadLatestArchive(): void {
    try {
      this.downloadArchive(this.archiveDownloadUrl());
    } catch {
      this.archiveError.set(this.i18n.translate('common.loadError'));
    }
  }

  private downloadArchive(rawUrl: string): void {
    const url = new URL(rawUrl, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unsupported archive URL');
    }

    const anchor = document.createElement('a');
    anchor.href = url.href;
    anchor.download = 'elgl-personal-data.json';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}
