import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { CoverPhotoService } from '../../../services/cover-photo.service';
import Cropper from 'cropperjs';

@Component({
  selector: 'app-profile-cover-photo',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="relative w-full rounded-xl overflow-hidden bg-surface">
      @if (previewUrl(); as url) {
        <img
          #cropperImage
          [src]="url"
          class="w-full h-auto"
          alt="{{ 'coverPhoto.previewAlt' | t }}"
        />
      }
      @if (!previewUrl()) {
        <label
          for="cover-file-input"
          class="flex flex-col items-center justify-center h-48 cursor-pointer border-dashed border-2 border-slate-600 hover:border-accent transition-colors rounded-xl"
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
            type="button"
            class="btn-secondary px-4 py-2 rounded-lg"
            (click)="cancel()"
          >
            {{ 'coverPhoto.cancel' | t }}
          </button>
          <button
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

  protected cropper: Cropper | null = null;
  protected previewUrl = signal<string>('');
  protected isLoading = signal(false);

  protected fileInput = viewChild<HTMLInputElement>('fileInput');
  protected cropperImage = viewChild<ElementRef<HTMLImageElement>>('cropperImage');

  constructor() {
    // Initialise cropper when preview image becomes available
    effect(() => {
      const url = this.previewUrl();
      if (!url) return;
      afterNextRender(() => {
        const imgEl = this.cropperImage()?.nativeElement;
        if (!imgEl) return;
        this.initCropper(imgEl);
      });
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  private initCropper(image: HTMLImageElement): void {
    if (this.cropper) {
      this.cropper.destroy();
    }
    this.cropper = new Cropper(image, {
      aspectRatio: 16 / 9,
      viewMode: 1,
      background: false,
      movable: true,
      zoomable: true,
      cropBoxResizable: true,
    });
  }

  protected async save(): Promise<void> {
    if (!this.cropper) return;
    const canvas = this.cropper.getCroppedCanvas({ width: 1920, height: 1080 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      this.isLoading.set(true);
      try {
        const newUrl = await this.coverPhotoService.upload(blob);
        this.coverUpdated.emit(newUrl);
      } catch {
        console.error('Cover photo upload failed'); // allowed per AGENTS.md
      } finally {
        this.isLoading.set(false);
      }
    }, 'image/webp');
  }

  protected cancel(): void {
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
    this.previewUrl.set('');
  }
}
