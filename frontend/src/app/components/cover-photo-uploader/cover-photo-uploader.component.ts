import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoverPhotoCropperComponent } from '../cover-photo-cropper/cover-photo-cropper.component';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-cover-photo-uploader',
  imports: [HlmButton, TranslatePipe, CoverPhotoCropperComponent],
  template: `
    <div class="relative mx-auto w-full min-w-0 max-w-2xl">
      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        (change)="onFileSelected($event)"
        class="hidden"
      />

      @if (!imageSource()) {
        <div
          class="group relative h-40 w-full overflow-hidden rounded-card border border-surface-100 bg-surface-200 shadow-card sm:h-48 md:h-64"
        >
          @if (currentCoverUrl()) {
            <img
              [src]="currentCoverUrl()"
              [alt]="'coverPhoto.previewAlt' | t"
              class="h-full w-full object-cover"
            />
          } @else {
            <div class="h-full w-full bg-gradient-to-br from-surface-300 to-surface-500"></div>
          }

          <button
            #fileTrigger
            hlmBtn
            type="button"
            variant="ghost"
            size="touch"
            class="absolute inset-0 h-full w-full max-w-full rounded-card bg-surface-500/90 text-text-primary opacity-100 transition-opacity duration-base ease-app whitespace-normal break-words text-center focus-visible:opacity-100 motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            (click)="fileInput.click()"
          >
            <span class="min-w-0 text-center">
              <svg
                aria-hidden="true"
                focusable="false"
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
              <span class="text-sm font-medium">
                {{
                  currentCoverUrl() ? ('coverPhoto.changeCover' | t) : ('coverPhoto.addCover' | t)
                }}
              </span>
            </span>
          </button>
        </div>

        @if (uploadError()) {
          <p role="alert" class="mt-2 break-words text-sm text-danger">{{ 'common.error' | t }}</p>
        }
      } @else {
        <div
          class="overflow-hidden rounded-card border border-surface-100 bg-surface-200 shadow-card"
        >
          <img
            [src]="croppedPreviewUrl() || imageSource()"
            [alt]="'coverPhoto.previewAlt' | t"
            class="w-full object-cover"
          />
        </div>

        <div class="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            #cropButton
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            (click)="startCropping()"
            [disabled]="isUploading()"
            class="w-full max-w-full whitespace-normal break-words text-center sm:w-auto"
          >
            {{ 'common.crop' | t }}
          </button>
          <button
            #uploadButton
            hlmBtn
            type="button"
            size="touch"
            (click)="uploadCropped()"
            [disabled]="isUploading() || !croppedBlob()"
            [attr.aria-busy]="isUploading() ? 'true' : null"
            class="w-full max-w-full whitespace-normal break-words text-center sm:w-auto"
          >
            {{ isUploading() ? ('common.uploading' | t) : ('common.upload' | t) }}
          </button>
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            (click)="reset()"
            [disabled]="isUploading()"
            class="w-full max-w-full whitespace-normal break-words text-center sm:w-auto"
          >
            {{ 'common.cancel' | t }}
          </button>
        </div>

        <div class="mt-2 min-h-5 text-sm" aria-live="polite" aria-atomic="true">
          @if (isUploading()) {
            <p class="text-text-muted">{{ 'common.uploading' | t }}</p>
          }
          @if (uploadError()) {
            <p role="alert" class="break-words text-danger">{{ 'common.error' | t }}</p>
          }
        </div>
      }

      @if (isCropping() && selectedFile()) {
        <app-cover-photo-cropper
          [imageFile]="selectedFile()!"
          (saveCover)="onCropSaved($event)"
          (cancelCrop)="cancelCrop()"
        />
      }
    </div>
  `,
})
export class CoverPhotoUploaderComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly fileTrigger = viewChild<ElementRef<HTMLButtonElement>>('fileTrigger');
  private readonly cropButton = viewChild<ElementRef<HTMLButtonElement>>('cropButton');
  private readonly uploadButton = viewChild<ElementRef<HTMLButtonElement>>('uploadButton');

  readonly currentCoverUrl = input<string>('');
  readonly coverPhotoUploaded = output<string>();

  readonly imageSource = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly isCropping = signal(false);
  readonly isUploading = signal(false);
  readonly croppedBlob = signal<Blob | null>(null);
  readonly croppedPreviewUrl = signal<string | null>(null);
  readonly uploadError = signal(false);

  private previewObjectUrl: string | null = null;

  onFileSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;

    const file = input.files[0];
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      this.uploadError.set(true);
      this.clearFileInput();
      this.focusAfterRender(this.fileTrigger);
      return;
    }

    this.selectedFile.set(file);
    this.isCropping.set(false);
    this.uploadError.set(false);
    this.clearCroppedPreview();

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result === 'string') {
        this.imageSource.set(result);
        this.focusAfterRender(this.cropButton);
      }
    };
    reader.onerror = () => {
      this.selectedFile.set(null);
      this.imageSource.set(null);
      this.uploadError.set(true);
      this.clearFileInput();
      this.focusAfterRender(this.fileTrigger);
    };
    reader.readAsDataURL(file);
  }

  startCropping(): void {
    if (!this.selectedFile() || this.isUploading()) return;
    this.isCropping.set(true);
  }

  cancelCrop(): void {
    this.isCropping.set(false);
  }

  onCropSaved(blob: Blob): void {
    if (!blob.size || !ALLOWED_IMAGE_TYPES.has(blob.type)) {
      this.uploadError.set(true);
      return;
    }

    this.clearCroppedPreview();
    this.croppedBlob.set(blob);
    this.previewObjectUrl = URL.createObjectURL(blob);
    this.croppedPreviewUrl.set(this.previewObjectUrl);
    this.isCropping.set(false);
    this.uploadError.set(false);
  }

  async uploadCropped(): Promise<void> {
    const blob = this.croppedBlob();
    if (!blob || this.isUploading()) return;

    this.isUploading.set(true);
    this.uploadError.set(false);
    let failed = false;

    try {
      const contentType = ALLOWED_IMAGE_TYPES.has(blob.type) ? blob.type : 'image/webp';
      const extension = this.extensionFor(contentType);
      const filename = `cover-${Date.now()}.${extension}`;

      const presignedResponse = await firstValueFrom(
        this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
          `${environment.apiUrl}/media/cover/presigned-url`,
          {
            filename,
            contentType,
            folder: 'cover-photos',
          },
        ),
      );

      if (!presignedResponse?.uploadUrl || !presignedResponse.objectKey) {
        throw new Error('cover_presign_failed');
      }

      const uploadResponse = await fetch(presignedResponse.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      });

      if (!uploadResponse.ok) {
        throw new Error('cover_upload_failed');
      }

      const confirmResponse = await firstValueFrom(
        this.http.post<{ coverUrl: string }>(`${environment.apiUrl}/media/cover/confirm`, {
          objectKey: presignedResponse.objectKey,
        }),
      );

      if (!confirmResponse?.coverUrl) {
        throw new Error('cover_confirm_failed');
      }

      this.coverPhotoUploaded.emit(confirmResponse.coverUrl);
      this.reset();
    } catch {
      failed = true;
      this.uploadError.set(true);
    } finally {
      this.isUploading.set(false);
      if (failed) {
        this.focusAfterRender(this.uploadButton);
      }
    }
  }

  reset(): void {
    this.imageSource.set(null);
    this.selectedFile.set(null);
    this.isCropping.set(false);
    this.isUploading.set(false);
    this.uploadError.set(false);
    this.clearCroppedPreview();
    this.clearFileInput();
    this.focusAfterRender(this.fileTrigger);
  }

  ngOnDestroy(): void {
    this.clearCroppedPreview();
  }

  private clearCroppedPreview(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    this.croppedBlob.set(null);
    this.croppedPreviewUrl.set(null);
  }

  private clearFileInput(): void {
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  private focusAfterRender(target: () => ElementRef<HTMLButtonElement> | undefined): void {
    afterNextRender(
      () => {
        target()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private extensionFor(contentType: string): string {
    switch (contentType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      default:
        return 'webp';
    }
  }
}
