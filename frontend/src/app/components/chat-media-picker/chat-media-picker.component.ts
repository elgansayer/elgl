import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import {
  ChatMediaQuality,
  ChatMediaService,
  UploadedChatMedia,
} from '../../services/chat-media.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

const ACCEPTED_MEDIA = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';

@Component({
  selector: 'app-chat-media-picker',
  imports: [
    CommonModule,
    HlmCheckbox,
    TranslatePipe,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  template: `
    <section
      class="w-full max-w-lg rounded-sheet border border-surface-100 bg-surface-200 p-4 shadow-lift sm:p-5"
      aria-labelledby="chat-media-title"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="chat-media-title" class="text-base font-black text-text-primary">Photo / video</h2>
          <p class="mt-1 text-xs text-text-secondary">
            Standard uses less data. HD keeps more image detail and allows larger videos.
          </p>
        </div>
        <app-button-secondary
          type="button"
          (clicked)="cancel()"
          customClass="min-h-11 min-w-11 px-3 text-sm"
          ariaLabel="Close media picker"
        >
          ✕
        </app-button-secondary>
      </div>

      <label
        class="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-surface-100 bg-surface-300 p-4 text-center focus-within:ring-2 focus-within:ring-primary"
      >
        <span class="text-sm font-bold text-text-primary">
          {{ selectedFile() ? selectedFile()!.name : 'Choose a photo or video' }}
        </span>
        <span class="mt-1 text-xs text-text-secondary">JPEG, PNG, WebP, MP4, WebM or MOV</span>
        <input
          type="file"
          class="sr-only"
          [accept]="acceptedMedia"
          (change)="onFileSelected($event)"
          aria-label="Choose a photo or video"
        />
      </label>

      @if (previewUrl(); as preview) {
        <div class="mt-4 overflow-hidden rounded-card border border-surface-100 bg-black/5">
          @if (selectedKind() === 'image') {
            <img [src]="preview" alt="Selected photo preview" class="max-h-72 w-full object-contain" />
          } @else {
            <video
              [src]="preview"
              controls
              preload="metadata"
              class="max-h-72 w-full object-contain"
              aria-label="Selected video preview"
            ></video>
          }
        </div>
      }

      <label class="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-card bg-surface-300 px-3 py-2">
        <span>
          <span class="block text-sm font-bold text-text-primary">HD quality</span>
          <span class="block text-xs text-text-secondary">Higher quality, larger upload</span>
        </span>
        <hlm-checkbox
          class="h-5 w-5"
          [checked]="quality() === 'hd'"
          (change)="toggleQuality()"
          aria-label="Send in HD quality"
        />
      </label>

      @if (error(); as message) {
        <p role="alert" class="mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ message }}
        </p>
      }

      <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <app-button-secondary
          type="button"
          (clicked)="cancel()"
          customClass="min-h-11 px-4 text-sm"
          [disabled]="isUploading()"
          [ariaLabel]="'common.cancel' | t"
        >
          {{ 'common.cancel' | t }}
        </app-button-secondary>
        <app-button-primary
          type="button"
          (clicked)="upload()"
          customClass="min-h-11 px-5 text-sm"
          [disabled]="!selectedFile() || isUploading()"
          [ariaLabel]="isUploading() ? ('common.uploading' | t) : ('common.upload' | t)"
        >
          {{ isUploading() ? ('common.uploading' | t) : ('common.upload' | t) }}
        </app-button-primary>
      </div>
    </section>
  `,
})
export class ChatMediaPickerComponent implements OnDestroy {
  private readonly chatMedia = inject(ChatMediaService);

  readonly uploaded = output<UploadedChatMedia>();
  readonly cancelled = output<void>();
  readonly selectedFile = signal<File | null>(null);
  readonly selectedKind = signal<'image' | 'video' | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly quality = signal<ChatMediaQuality>('standard');
  readonly isUploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly acceptedMedia = ACCEPTED_MEDIA;

  ngOnDestroy(): void {
    this.revokePreview();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const type = file.type.split(';', 1)[0].trim().toLowerCase();
    const isImage = type.startsWith('image/');
    const isVideo = type.startsWith('video/');
    if (!isImage && !isVideo) {
      this.error.set('Choose a supported photo or video file.');
      input.value = '';
      return;
    }

    this.revokePreview();
    this.selectedFile.set(file);
    this.selectedKind.set(isImage ? 'image' : 'video');
    this.previewUrl.set(URL.createObjectURL(file));
    this.error.set(null);
  }

  toggleQuality(): void {
    this.quality.set(this.quality() === 'hd' ? 'standard' : 'hd');
    this.error.set(null);
  }

  async upload(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.isUploading()) return;

    this.isUploading.set(true);
    this.error.set(null);
    try {
      const uploaded = await this.chatMedia.upload(file, this.quality());
      this.uploaded.emit(uploaded);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    if (this.isUploading()) return;
    this.cancelled.emit();
  }

  private revokePreview(): void {
    const preview = this.previewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.previewUrl.set(null);
  }
}
