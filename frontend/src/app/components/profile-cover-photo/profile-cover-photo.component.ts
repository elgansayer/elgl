import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoService } from '../../services/cover-photo.service';

@Component({
  selector: 'app-profile-cover-photo',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="relative w-full rounded-xl overflow-hidden bg-surface">
      @if (previewUrl(); as url) {
        <img
          #previewImage
          [src]="url"
          class="w-full h-auto"
          alt="{{ 'coverPhoto.previewAlt' | t }}"
        />
      }
      @if (!previewUrl()) {
        <label
          for="cover-file-input"
          class="flex flex-col items-center justify-center h-48 cursor-pointer border-dashed border-2 border-surface-100 hover:border-accent transition-colors rounded-xl"
        >
          <span class="text-lg text-muted">{{ 'coverPhoto.uploadLabel' | t }}</span>
          <span class="text-sm text-muted mt-1">{{ 'coverPhoto.supportedFormats' | t }}</span>
        </label>
      }
      <input
        #fileInput
        id="cover-file-input"
        type="file"
        accept="image/*"
        (change)="onFileSelected($event)"
        class="hidden"
      />
      @if (previewUrl()) {
        <div class="flex gap-2 mt-4 justify-end">
          <button
            hlmBtn
            type="button"
            class="btn-secondary px-4 py-2 rounded-lg"
            (click)="cancel()"
          >
            {{ 'coverPhoto.cancel' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            class="btn-primary px-6 py-2 rounded-lg"
            (click)="save()"
            [disabled]="isLoading()"
          >
            @if (isLoading()) {
              <span class="loading-spinner"></span>
            }
            {{ 'coverPhoto.save' | t }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ProfileCoverPhotoComponent {
  currentCoverUrl = input<string>('');
  coverUpdated = output<string>();

  private coverPhotoService = inject(CoverPhotoService);

  previewUrl = signal<string>('');
  protected isLoading = signal(false);

  protected fileInput = viewChild<HTMLInputElement>('fileInput');

  protected selectedFile: File | null = null;

  onFileSelected(event: Event): void {
    const target = event.target;
    if (!target || !(target instanceof HTMLInputElement)) return;
    const input = target;
    if (!input.files || input.files.length === 0) return;
    this.selectedFile = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.previewUrl.set(reader.result);
      }
    };
    reader.readAsDataURL(this.selectedFile);
  }

  protected async save(): Promise<void> {
    const file = this.selectedFile;
    if (!file) return;
    this.isLoading.set(true);
    try {
      const newUrl = await this.coverPhotoService.upload(file);
      this.coverUpdated.emit(newUrl);
    } catch {
      console.error('Cover photo upload failed'); // allowed per AGENTS.md
    } finally {
      this.isLoading.set(false);
    }
  }

  protected cancel(): void {
    this.previewUrl.set('');
    this.selectedFile = null;
    const inputEl = this.fileInput();
    if (inputEl) {
      inputEl.value = '';
    }
  }
}
