import { Component, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { ImageCropperComponent } from 'ngx-image-cropper';

import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-cover-photo-cropper',
  imports: [TranslatePipe, ImageCropperComponent, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-lg space-y-4 rounded-xl border border-surface-100 bg-surface-200 p-6 shadow-2xl"
        aria-labelledby="cover-photo-crop-title"
      >
        <h3 id="cover-photo-crop-title" class="text-lg font-semibold text-text-primary">
          {{ 'coverPhoto.crop' | t }}
        </h3>

        <div class="relative max-h-64 overflow-hidden rounded-lg">
          <image-cropper
            [imageFile]="imageFile()"
            [maintainAspectRatio]="true"
            [aspectRatio]="3 / 1"
            [resizeToWidth]="1200"
            [cropperMinWidth]="300"
            [onlyScaleDown]="true"
            format="webp"
            (imageCropped)="onImageCropped($event)"
            (loadImageFailed)="onLoadImageFailed()"
          />
        </div>

        <div class="flex justify-end gap-3">
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="cancel()">
            {{ 'common.cancel' | t }}
          </button>
          <button hlmBtn type="button" size="touch" (click)="save()" [disabled]="!croppedBlob()">
            {{ 'coverPhoto.save' | t }}
          </button>
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class CoverPhotoCropperComponent {
  readonly imageFile = input.required<File>();
  readonly saveCover = output<Blob>();
  readonly cancelCrop = output<void>();

  readonly croppedBlob = signal<Blob | null>(null);
  readonly dialogState = signal<HlmDialogState>('open');

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === this.dialogState()) return;

    this.dialogState.set(state);
    if (state === 'closed') {
      this.cancelCrop.emit();
    }
  }

  cancel(): void {
    if (this.dialogState() === 'closed') return;

    this.dialogState.set('closed');
    this.cancelCrop.emit();
  }

  onImageCropped(event: { blob?: Blob | null }): void {
    if (event.blob) {
      this.croppedBlob.set(event.blob);
    }
  }

  onLoadImageFailed(): void {
    console.error('Failed to load image for cropping');
  }

  save(): void {
    const blob = this.croppedBlob();
    if (blob) {
      this.saveCover.emit(blob);
    }
  }
}
