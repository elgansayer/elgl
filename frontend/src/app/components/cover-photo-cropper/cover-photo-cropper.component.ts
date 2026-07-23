import { Component, input, output, signal } from '@angular/core';
import { ImageCropperComponent } from 'ngx-image-cropper';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cover-photo-cropper',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70" (click)="cancel.emit()">
      <div class="bg-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl" (click)="$event.stopPropagation()">
        <h3 class="text-lg font-semibold text-white mb-4">Crop Cover Photo</h3>

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
          <button
            (click)="cancel.emit()"
            class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            (click)="save()"
            [disabled]="!croppedBlob()"
            class="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Save Cover Photo
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CoverPhotoCropperComponent {
  readonly imageFile = input.required<File>();
  readonly saveCover = output<Blob>();
  readonly cancel = output<void>();

  readonly croppedBlob = signal<Blob | null>(null);

  onImageCropped(event: any) {
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
