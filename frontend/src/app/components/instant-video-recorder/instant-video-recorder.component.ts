import { Component, ElementRef, OnDestroy, ViewChild, inject, output, signal } from '@angular/core';
import { ChatMediaService, UploadedChatMedia } from '../../services/chat-media.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

const MAX_DURATION_SECONDS = 30;
const MAX_RECORDED_BYTES = 12 * 1024 * 1024;
const VIDEO_BITS_PER_SECOND = 800_000;
const AUDIO_BITS_PER_SECOND = 64_000;

@Component({
  selector: 'app-instant-video-recorder',
  imports: [AppButtonPrimaryComponent, AppButtonSecondaryComponent, TranslatePipe],
  template: `
    <section
      class="w-full max-w-md rounded-sheet border border-surface-100 bg-surface-0 p-4 shadow-lift"
      aria-labelledby="instant-video-title"
      aria-describedby="instant-video-description"
    >
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="instant-video-title" class="text-base font-bold text-text-primary">
            {{ 'videoNote.title' | t }}
          </h2>
          <p id="instant-video-description" class="mt-1 text-sm text-text-secondary">
            {{ 'videoNote.description' | t }}
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-surface-100 px-2 py-1 text-xs font-semibold text-text-secondary"
          [attr.aria-label]="'videoNote.maxDuration' | t: { seconds: maxDurationSeconds }"
        >
          {{ formatDuration(durationSeconds()) }} / 00:30
        </span>
      </div>

      <div class="mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-full bg-black">
        @if (previewUrl()) {
          <video
            [src]="previewUrl()!"
            controls
            playsinline
            preload="metadata"
            class="h-full w-full object-cover"
            [attr.aria-label]="'videoNote.recordedPreview' | t"
          ></video>
        } @else {
          <video
            #cameraPreview
            autoplay
            muted
            playsinline
            class="h-full w-full object-cover"
            [attr.aria-label]="'videoNote.cameraPreview' | t"
          ></video>
        }
      </div>

      @if (isRecording()) {
        <p class="mt-3 text-center text-sm font-semibold text-danger-ink" role="status" aria-live="polite">
          {{ 'videoNote.recording' | t: { time: formatDuration(durationSeconds()) } }}
        </p>
      }

      @if (errorMessage()) {
        <p class="mt-3 rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-text-primary" role="alert">
          {{ errorMessage() }}
        </p>
      }

      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <app-button-secondary
          type="button"
          (clicked)="cancel()"
          [disabled]="isUploading()"
          customClass="min-h-11 px-4"
          [ariaLabel]="'videoNote.cancelAria' | t"
        >
          {{ 'common.cancel' | t }}
        </app-button-secondary>

        @if (!isRecording() && !previewUrl()) {
          <app-button-primary
            type="button"
            (clicked)="startRecording()"
            [disabled]="isRequestingPermission() || isUploading()"
            customClass="min-h-11 px-4"
            [ariaLabel]="'videoNote.startAria' | t"
          >
            {{ isRequestingPermission() ? ('videoNote.openingCamera' | t) : ('videoNote.record' | t) }}
          </app-button-primary>
        }

        @if (isRecording()) {
          <app-button-primary
            type="button"
            (clicked)="stopRecording()"
            customClass="min-h-11 px-4"
            [ariaLabel]="'videoNote.stopAria' | t"
          >
            {{ 'videoNote.stop' | t }}
          </app-button-primary>
        }

        @if (!isRecording() && previewUrl()) {
          <app-button-secondary
            type="button"
            (clicked)="retake()"
            [disabled]="isUploading()"
            customClass="min-h-11 px-4"
            [ariaLabel]="'videoNote.retakeAria' | t"
          >
            {{ 'videoNote.retake' | t }}
          </app-button-secondary>
          <app-button-primary
            type="button"
            (clicked)="uploadAndSend()"
            [disabled]="isUploading()"
            customClass="min-h-11 px-4"
            [ariaLabel]="'videoNote.sendAria' | t"
          >
            {{ isUploading() ? ('videoNote.uploading' | t) : ('videoNote.send' | t) }}
          </app-button-primary>
        }
      </div>
    </section>
  `,
})
export class InstantVideoRecorderComponent implements OnDestroy {
  @ViewChild('cameraPreview') private cameraPreview?: ElementRef<HTMLVideoElement>;

  readonly uploaded = output<UploadedChatMedia>();
  readonly cancelled = output<void>();

  readonly isRecording = signal(false);
  readonly isRequestingPermission = signal(false);
  readonly isUploading = signal(false);
  readonly durationSeconds = signal(0);
  readonly previewUrl = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private readonly mediaService = inject(ChatMediaService);
  private readonly i18n = inject(I18nService);
  protected readonly maxDurationSeconds = MAX_DURATION_SECONDS;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private recordedBlob: Blob | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private discardOnStop = false;

  async startRecording(): Promise<void> {
    if (this.isRecording() || this.isRequestingPermission() || this.isUploading()) return;

    this.errorMessage.set(null);
    this.clearRecordingPreview();
    this.durationSeconds.set(0);

    if (!globalThis.navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.errorMessage.set(this.i18n.translate('videoNote.errorUnsupported'));
      return;
    }

    this.isRequestingPermission.set(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 720, max: 1280 },
          height: { ideal: 720, max: 1280 },
        },
      });
      this.stream = stream;
      this.attachPreview(stream);

      const mimeType = this.pickMimeType();
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        ...(mimeType ? { mimeType } : {}),
      };
      const recorder = new MediaRecorder(stream, options);
      this.mediaRecorder = recorder;
      this.chunks = [];
      this.discardOnStop = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      recorder.onerror = () => {
        this.errorMessage.set(this.i18n.translate('videoNote.errorRecordingFailed'));
        this.stopRecording();
      };
      recorder.onstop = () => this.finaliseRecording(recorder.mimeType);

      recorder.start(250);
      this.isRecording.set(true);
      this.timer = setInterval(() => {
        const next = this.durationSeconds() + 1;
        this.durationSeconds.set(next);
        if (next >= MAX_DURATION_SECONDS) this.stopRecording();
      }, 1000);
    } catch {
      this.stopStream();
      this.errorMessage.set(this.i18n.translate('videoNote.errorPermission'));
    } finally {
      this.isRequestingPermission.set(false);
    }
  }

  stopRecording(): void {
    if (!this.mediaRecorder || !this.isRecording()) return;
    this.isRecording.set(false);
    this.clearTimer();
    if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.stopStream();
  }

  async retake(): Promise<void> {
    if (this.isUploading()) return;
    this.clearRecordingPreview();
    await this.startRecording();
  }

  async uploadAndSend(): Promise<void> {
    const blob = this.recordedBlob;
    if (!blob || this.isUploading()) return;

    if (blob.size <= 0 || blob.size > MAX_RECORDED_BYTES) {
      this.errorMessage.set(this.i18n.translate('videoNote.errorTooLarge'));
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(null);
    try {
      const contentType = this.normaliseRecordedType(blob.type);
      const extension = contentType === 'video/mp4' ? 'mp4' : 'webm';
      const file = new File([blob], `video-note-${Date.now()}.${extension}`, { type: contentType });
      const uploaded = await this.mediaService.upload(file, 'standard');
      if (uploaded.kind !== 'video') throw new Error('Unexpected media kind');
      this.uploaded.emit({ ...uploaded, presentation: 'instant_video' });
    } catch {
      this.errorMessage.set(this.i18n.translate('videoNote.errorUploadFailed'));
    } finally {
      this.isUploading.set(false);
    }
  }

  cancel(): void {
    if (this.isUploading()) return;
    this.discardOnStop = true;
    if (this.isRecording()) this.stopRecording();
    this.stopStream();
    this.clearTimer();
    this.clearRecordingPreview();
    this.cancelled.emit();
  }

  formatDuration(seconds: number): string {
    const bounded = Math.max(0, Math.min(MAX_DURATION_SECONDS, Math.floor(seconds)));
    return `00:${bounded.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.discardOnStop = true;
    this.clearTimer();
    if (this.mediaRecorder?.state && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Browser teardown can race recorder shutdown; tracks are stopped below regardless.
      }
    }
    this.stopStream();
    this.clearRecordingPreview();
  }

  private attachPreview(stream: MediaStream): void {
    queueMicrotask(() => {
      const video = this.cameraPreview?.nativeElement;
      if (!video) return;
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    });
  }

  private finaliseRecording(recorderMimeType: string): void {
    this.stopStream();
    if (this.discardOnStop) {
      this.chunks = [];
      this.recordedBlob = null;
      return;
    }

    const type = this.normaliseRecordedType(recorderMimeType || this.chunks[0]?.type || 'video/webm');
    const blob = new Blob(this.chunks, { type });
    this.chunks = [];
    if (blob.size <= 0) {
      this.recordedBlob = null;
      this.errorMessage.set(this.i18n.translate('videoNote.errorNoVideo'));
      return;
    }
    if (blob.size > MAX_RECORDED_BYTES) {
      this.recordedBlob = null;
      this.errorMessage.set(this.i18n.translate('videoNote.errorTooLarge'));
      return;
    }

    this.recordedBlob = blob;
    this.previewUrl.set(URL.createObjectURL(blob));
  }

  private pickMimeType(): string | undefined {
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  }

  private normaliseRecordedType(rawType: string): 'video/webm' | 'video/mp4' {
    const type = rawType.split(';', 1)[0].trim().toLowerCase();
    return type === 'video/mp4' ? 'video/mp4' : 'video/webm';
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const video = this.cameraPreview?.nativeElement;
    if (video) video.srcObject = null;
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private clearRecordingPreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.recordedBlob = null;
  }
}
