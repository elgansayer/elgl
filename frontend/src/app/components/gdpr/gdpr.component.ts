import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { GdprService } from '../../services/gdpr.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-gdpr',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="max-w-lg mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-bold">{{ 'gdpr.title' | t }}</h1>
      <p class="text-secondary">{{ 'gdpr.description' | t }}</p>

      <section class="bg-surface p-4 rounded-lg space-y-2">
        <h2 class="text-lg font-semibold">{{ 'gdpr.archiveSection' | t }}</h2>
        <p>{{ 'gdpr.archiveInfo' | t }}</p>
        <button
          (click)="requestArchive()"
          class="btn-primary"
          [disabled]="loading"
        >
          {{ loading ? ('common.loading' | t) : ('gdpr.requestArchiveBtn' | t) }}
        </button>
        @if (archiveSuccess) {
          <p class="text-green-500">{{ 'gdpr.archiveSuccess' | t }}</p>
        }
        @if (archiveError) {
          <p class="text-red-500">{{ archiveError }}</p>
        }
      </section>

      <section class="bg-surface p-4 rounded-lg space-y-2">
        <h2 class="text-lg font-semibold">{{ 'gdpr.deleteSection' | t }}</h2>
        <p>{{ 'gdpr.deleteInfo' | t }}</p>
        <label class="flex items-center space-x-2">
          <input type="checkbox" [(ngModel)]="confirmDelete" class="checkbox" />
          <span>{{ 'gdpr.deleteConfirmLabel' | t }}</span>
        </label>
        <button
          (click)="deleteAccount()"
          class="btn-danger"
          [disabled]="!confirmDelete || deleting"
        >
          {{ deleting ? ('common.loading' | t) : ('gdpr.deleteAccountBtn' | t) }}
        </button>
        @if (deleteSuccess) {
          <p class="text-green-500">{{ 'gdpr.deleteSuccess' | t }}</p>
        }
        @if (deleteError) {
          <p class="text-red-500">{{ deleteError }}</p>
        }
      </section>
    </div>
  `,
  styles: [`
    .btn-primary { @apply bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50; }
    .btn-danger { @apply bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50; }
    .checkbox { @apply w-5 h-5; }
  `],
})
export class GdprComponent {
  private gdprService = inject(GdprService);
  private i18n = inject(I18nService);

  loading = false;
  archiveSuccess = false;
  archiveError = '';

  confirmDelete = false;
  deleting = false;
  deleteSuccess = false;
  deleteError = '';

  async requestArchive(): Promise<void> {
    this.loading = true;
    this.archiveSuccess = false;
    this.archiveError = '';
    try {
      await this.gdprService.requestArchive();
      this.archiveSuccess = true;
    } catch (err: unknown) {
      this.archiveError = this.i18n.translate('common.loadError');
    } finally {
      this.loading = false;
    }
  }

  async deleteAccount(): Promise<void> {
    if (!this.confirmDelete) return;
    this.deleting = true;
    this.deleteSuccess = false;
    this.deleteError = '';
    try {
      await this.gdprService.deleteAccount(true);
      this.deleteSuccess = true;
    } catch (err: unknown) {
      this.deleteError = this.i18n.translate('common.loadError');
    } finally {
      this.deleting = false;
    }
  }
}
