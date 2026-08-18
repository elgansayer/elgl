import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal } from '@angular/core';
import { ImageCropperComponent } from 'ngx-image-cropper';

import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-cover-photo-cropper',
  imports: [HlmButton, ImageCropperComponent, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      (click)="cancelCrop.emit()"
      (keydown.enter)="cancelCrop.emit()"
      (keydown.space)="cancelCrop.emit(); $event.preventDefault()"
      tabindex="0"
      role="button"
    >
      <div
        class="bg-surface-200 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        (click)="$event.stopPropagation()"
        (keydown.enter)="$event.stopPropagation()"
        (keydown.space)="$event.stopPropagation(); $event.preventDefault()"
        tabindex="0"
        role="button"
      >
        <h3 class="text-lg font-semibold text-text-primary mb-4">{{ 'coverPhoto.crop' | t }}</h3>

        <div class="relative max-h-64 overflow-hidden rounded-lg mb-4">
          <image-cropper
            [imageFile]="imageFile()"
            [maintainAspectRatio]="true"
            [aspectRatio]="3 / 1"
            [resizeToWidth]="1200"
            [resizeToHeight]="400"
            format="jpeg"
            (imageCropped)="onImageCropped($event)"
            (loadImageFailed)="onLoadImageFailed()"
          />
        </div>

        <div class="flex justify-end gap-3">
          <button hlmBtn
            (click)="cancelCrop.emit()"
            class="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface-200 hover:bg-surface-100 rounded-lg transition-colors"
          >
            {{ 'common.cancel' | t }}
          </button>
          <button hlmBtn
            (click)="save()"
            [disabled]="!croppedBlob()"
            class="px-4 py-2 text-sm font-medium text-on-fill bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {{ 'coverPhoto.save' | t }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CoverPhotoCropperComponent {
  readonly imageFile = input.required<File>();
  readonly saveCover = output<Blob>();
  readonly cancelCrop = output<void>();

  readonly croppedBlob = signal<Blob | null>(null);

  onImageCropped(event: { blob?: Blob | null }): void {
    if (event.blob) {
      this.croppedBlob.set(event.blob);
    }
  }

  onLoadImageFailed() {
    console.error('Failed to load image for cropping');
  }

  save() {
    const blob = this.croppedBlob();
    if (blob) {
      this.saveCover.emit(blob);
    }
  }
}
