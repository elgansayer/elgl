import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal, output, input, inject } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { A11yClickableDirective } from '../primitives/a11y-clickable';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-cover-photo-uploader',
  imports: [HlmButton, TranslatePipe, A11yClickableDirective],
  template: `
    <div class="relative mx-auto w-full max-w-2xl">
      <!-- Hidden file input -->
      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        (change)="onFileSelected($event)"
        class="hidden"
      />

      <!-- Current cover photo or upload trigger -->
      @if (!imageSource()) {
        <div
          class="group relative h-40 w-full overflow-hidden rounded-card border border-surface-100 bg-surface-200 shadow-card sm:h-48 md:h-64"
        >
          @if (currentCoverUrl()) {
            <img
              [src]="currentCoverUrl()"
              alt="{{ 'coverPhoto.previewAlt' | t }}"
              class="h-full w-full object-cover"
            />
          } @else {
            <div class="h-full w-full bg-gradient-to-br from-surface-300 to-surface-500"></div>
          }
          <div
            class="absolute inset-0 flex cursor-pointer items-center justify-center bg-surface-500/90 text-text-primary opacity-100 transition-opacity duration-base ease-app sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            (click)="fileInput.click()"
            appA11yClickable
            tabindex="0"
          >
            <div class="text-center">
              <svg
                class="mx-auto mb-2 h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span class="text-sm font-medium">{{
                currentCoverUrl() ? ('coverPhoto.changeCover' | t) : ('coverPhoto.addCover' | t)
              }}</span>
            </div>
          </div>
        </div>
      }

      <!-- Cropping interface -->
      @if (imageSource()) {
        <div class="relative">
          <div
            class="relative overflow-hidden rounded-card border border-surface-100 bg-surface-200 shadow-card"
            #imageContainer
          >
            <img
              [src]="imageSource()"
              alt="Image to crop"
              (load)="onImageLoad($event)"
              class="w-full select-none"
              draggable="false"
              #imageElement
            />

            @if (isCropping()) {
              <div class="absolute inset-0">
                <!-- Theme-aware overlay with crop window -->
                <svg
                  class="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="cropMask">
                      <rect width="100" height="100" fill="white" />
                      <rect
                        [attr.x]="(cropBox().x / imageWidth()) * 100"
                        [attr.y]="(cropBox().y / imageHeight()) * 100"
                        [attr.width]="(cropBox().width / imageWidth()) * 100"
                        [attr.height]="(cropBox().height / imageHeight()) * 100"
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect
                    width="100"
                    height="100"
                    fill="rgb(var(--surface-900-rgb) / 0.55)"
                    mask="url(#cropMask)"
                  />
                </svg>

                <!-- Crop box with handles -->
                <div
                  class="absolute cursor-move border-2 border-primary"
                  [style.left.px]="cropBox().x"
                  [style.top.px]="cropBox().y"
                  [style.width.px]="cropBox().width"
                  [style.height.px]="cropBox().height"
                  (mousedown)="onCropBoxMouseDown($event)"
                  (touchstart)="onCropBoxTouchStart($event)"
                >
                  <!-- Corner handles -->
                  <div
                    class="absolute -top-1.5 -start-1.5 h-3 w-3 cursor-nw-resize rounded-full bg-primary ring-2 ring-on-fill"
                    (mousedown)="onHandleMouseDown($event, 'nw')"
                    (touchstart)="onHandleTouchStart($event, 'nw')"
                  ></div>
                  <div
                    class="absolute -top-1.5 -end-1.5 h-3 w-3 cursor-ne-resize rounded-full bg-primary ring-2 ring-on-fill"
                    (mousedown)="onHandleMouseDown($event, 'ne')"
                    (touchstart)="onHandleTouchStart($event, 'ne')"
                  ></div>
                  <div
                    class="absolute -bottom-1.5 -start-1.5 h-3 w-3 cursor-sw-resize rounded-full bg-primary ring-2 ring-on-fill"
                    (mousedown)="onHandleMouseDown($event, 'sw')"
                    (touchstart)="onHandleTouchStart($event, 'sw')"
                  ></div>
                  <div
                    class="absolute -bottom-1.5 -end-1.5 h-3 w-3 cursor-se-resize rounded-full bg-primary ring-2 ring-on-fill"
                    (mousedown)="onHandleMouseDown($event, 'se')"
                    (touchstart)="onHandleTouchStart($event, 'se')"
                  ></div>
                </div>
              </div>
            }
          </div>

          <!-- Action buttons -->
          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            @if (!isCropping()) {
              <button
                hlmBtn
                type="button"
                variant="secondary"
                size="touch"
                (click)="startCropping()"
                class="w-full sm:w-auto"
              >
                {{ 'common.crop' | t }}
              </button>
            } @else {
              <button
                hlmBtn
                type="button"
                size="touch"
                (click)="applyCrop()"
                class="w-full sm:w-auto"
              >
                {{ 'common.applyCrop' | t }}
              </button>
              <button
                hlmBtn
                type="button"
                variant="secondary"
                size="touch"
                (click)="cancelCrop()"
                class="w-full sm:w-auto"
              >
                {{ 'common.cancel' | t }}
              </button>
            }
            <button
              hlmBtn
              type="button"
              size="touch"
              (click)="uploadCropped()"
              [disabled]="isUploading()"
              class="w-full sm:w-auto"
            >
              {{ isUploading() ? ('common.uploading' | t) : ('common.upload' | t) }}
            </button>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              (click)="reset()"
              class="w-full sm:w-auto"
            >
              {{ 'common.cancel' | t }}
            </button>
          </div>

          <!-- Preview -->
          @if (croppedPreviewUrl()) {
            <div
              class="mt-4 rounded-card border border-surface-100 bg-surface-200 p-3 shadow-card sm:p-4"
            >
              <p class="mb-2 text-sm text-text-muted">{{ 'common.preview' | t }}</p>
              <img [src]="croppedPreviewUrl()" alt="Cropped preview" class="w-full rounded-card" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CoverPhotoUploaderComponent {
  private http = inject(HttpClient);

  readonly currentCoverUrl = input<string>('');
  readonly coverPhotoUploaded = output<string>();

  readonly imageSource = signal<string | null>(null);
  readonly isCropping = signal(false);
  readonly isUploading = signal(false);
  readonly croppedPreviewUrl = signal<string | null>(null);

  private originalImage: HTMLImageElement | null = null;
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d');

  readonly cropBox = signal<CropBox>({ x: 0, y: 0, width: 200, height: 100 });
  readonly imageWidth = signal(0);
  readonly imageHeight = signal(0);

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCropBox: CropBox = { x: 0, y: 0, width: 0, height: 0 };
  private activeHandle: string | null = null;

  onFileSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        this.imageSource.set(result);
        this.isCropping.set(false);
        this.croppedPreviewUrl.set(null);
      }
    };
    reader.readAsDataURL(file);
  }

  onImageLoad(event: Event): void {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    this.originalImage = img;
    this.imageWidth.set(img.naturalWidth);
    this.imageHeight.set(img.naturalHeight);

    // Set initial crop to center with 3:1 aspect ratio
    const aspectRatio = 3;
    let cropWidth = Math.min(img.naturalWidth * 0.8, 800);
    let cropHeight = cropWidth / aspectRatio;

    if (cropHeight > img.naturalHeight * 0.8) {
      cropHeight = img.naturalHeight * 0.8;
      cropWidth = cropHeight * aspectRatio;
    }

    this.cropBox.set({
      x: (img.naturalWidth - cropWidth) / 2,
      y: (img.naturalHeight - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    });
  }

  startCropping(): void {
    this.isCropping.set(true);
  }

  applyCrop(): void {
    if (!this.originalImage || !this.ctx) return;

    const box = this.cropBox();
    this.canvas.width = box.width;
    this.canvas.height = box.height;
    this.ctx.drawImage(
      this.originalImage,
      box.x,
      box.y,
      box.width,
      box.height,
      0,
      0,
      box.width,
      box.height,
    );
    this.croppedPreviewUrl.set(this.canvas.toDataURL('image/jpeg', 0.9));
    this.isCropping.set(false);
  }

  cancelCrop(): void {
    this.isCropping.set(false);
  }

  async uploadCropped(): Promise<void> {
    if (!this.croppedPreviewUrl()) return;

    this.isUploading.set(true);
    try {
      const blob = this.dataUrlToBlob(this.croppedPreviewUrl()!);
      const filename = `cover-${Date.now()}.jpg`;

      // Get presigned URL from backend
      const presignedResponse = await firstValueFrom(
        this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
          `${environment.apiUrl}/media/cover/presigned-url`,
          {
            filename,
            contentType: 'image/jpeg',
            folder: 'covers',
          },
        ),
      );

      if (!presignedResponse) throw new Error('Failed to get presigned URL');

      // Upload to Cloudflare R2
      const uploadResponse = await fetch(presignedResponse.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');

      // Confirm upload with backend
      const confirmResponse = await firstValueFrom(
        this.http.post<{ coverUrl: string }>(`${environment.apiUrl}/media/cover/confirm`, {
          objectKey: presignedResponse.objectKey,
        }),
      );

      if (confirmResponse) {
        this.coverPhotoUploaded.emit(confirmResponse.coverUrl);
      }

      this.reset();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      this.isUploading.set(false);
    }
  }

  reset(): void {
    this.imageSource.set(null);
    this.isCropping.set(false);
    this.isUploading.set(false);
    this.croppedPreviewUrl.set(null);
    this.originalImage = null;
  }

  onCropBoxMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartCropBox = { ...this.cropBox() };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.cropBox.update((box) => ({
        x: Math.max(0, Math.min(this.imageWidth() - box.width, this.dragStartCropBox.x + dx)),
        y: Math.max(0, Math.min(this.imageHeight() - box.height, this.dragStartCropBox.y + dy)),
        width: box.width,
        height: box.height,
      }));
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onCropBoxTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    this.isDragging = true;
    this.dragStartX = touch.clientX;
    this.dragStartY = touch.clientY;
    this.dragStartCropBox = { ...this.cropBox() };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.isDragging) return;
      const t = e.touches[0];
      const dx = t.clientX - this.dragStartX;
      const dy = t.clientY - this.dragStartY;
      this.cropBox.update((box) => ({
        x: Math.max(0, Math.min(this.imageWidth() - box.width, this.dragStartCropBox.x + dx)),
        y: Math.max(0, Math.min(this.imageHeight() - box.height, this.dragStartCropBox.y + dy)),
        width: box.width,
        height: box.height,
      }));
    };

    const onTouchEnd = () => {
      this.isDragging = false;
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }

  onHandleMouseDown(event: MouseEvent, handle: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeHandle = handle;
    this.dragStartX = event.clientX;
    this.dragStartCropBox = { ...this.cropBox() };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.activeHandle) return;
      const dx = e.clientX - this.dragStartX;
      this.resizeCropBox(dx);
    };

    const onMouseUp = () => {
      this.activeHandle = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onHandleTouchStart(event: TouchEvent, handle: string): void {
    event.preventDefault();
    event.stopPropagation();
    const touch = event.touches[0];
    this.activeHandle = handle;
    this.dragStartX = touch.clientX;
    this.dragStartCropBox = { ...this.cropBox() };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.activeHandle) return;
      const t = e.touches[0];
      const dx = t.clientX - this.dragStartX;
      this.resizeCropBox(dx);
    };

    const onTouchEnd = () => {
      this.activeHandle = null;
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }

  private resizeCropBox(dx: number): void {
    const imgW = this.imageWidth();
    const imgH = this.imageHeight();
    const box = this.dragStartCropBox;
    let newX: number;
    let newW: number;
    let newH: number;
    let newY: number;

    const aspectRatio = 3;

    switch (this.activeHandle) {
      case 'nw':
        newX = Math.max(0, box.x + dx);
        newW = box.width + (box.x - newX);
        newH = newW / aspectRatio;
        newY = box.y + (box.height - newH);
        break;
      case 'ne':
        newX = box.x;
        newW = Math.max(100, box.width + dx);
        newH = newW / aspectRatio;
        newY = box.y + (box.height - newH);
        break;
      case 'sw':
        newW = Math.max(100, box.width - dx);
        newH = newW / aspectRatio;
        newX = box.x + (box.width - newW);
        newY = box.y;
        break;
      case 'se':
        newX = box.x;
        newW = Math.max(100, box.width + dx);
        newH = newW / aspectRatio;
        newY = box.y;
        break;
      default:
        newX = box.x;
        newW = box.width;
        newH = box.height;
        newY = box.y;
        break;
    }

    // Clamp to image bounds
    newX = Math.max(0, Math.min(imgW - newW, newX));
    newY = Math.max(0, Math.min(imgH - newH, newY));
    newW = Math.min(newW, imgW - newX);
    newH = Math.min(newH, imgH - newY);

    this.cropBox.set({ x: newX, y: newY, width: newW, height: newH });
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)![1];
    const bytes = atob(parts[1]);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      array[i] = bytes.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  }
}
