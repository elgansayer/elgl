import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { VoiceRecorderComponent } from './voice-recorder.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

import { MediaService } from '../../services/media.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockMediaService {
  uploadVoiceNote = vi.fn().mockResolvedValue({ url: 'https://media.url/voice.ogg' });
}

class MockedMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) } as BlobEvent);
    this.onstop?.();
  }
}

describe('VoiceRecorderComponent', () => {
  let component: VoiceRecorderComponent;
  let fixture: ComponentFixture<VoiceRecorderComponent>;
  let stopTrack: ReturnType<typeof vi.fn>;
  let mediaService: MockMediaService;

  beforeEach(async () => {
    stopTrack = vi.fn();
    const streamMock = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      configurable: true,
      value: MockedMediaRecorder,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(streamMock),
      },
    });

    await TestBed.configureTestingModule({
      imports: [VoiceRecorderComponent],
      providers: [{ provide: MediaService, useClass: MockMediaService }],
    })
      .overrideComponent(VoiceRecorderComponent, {
        set: {
          imports: [
            MockTranslatePipe,
            AppCardComponent,
            AppChipComponent,
            AppButtonPrimaryComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
    mediaService = TestBed.inject(MediaService) as unknown as MockMediaService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should stop the media stream and clear the timer when destroyed mid-recording', async () => {
    vi.useFakeTimers();
    try {
      await component.startRecording();
      expect(component.isRecording()).toBe(true);

      fixture.destroy();

      expect(stopTrack).toHaveBeenCalled();

      const durationBeforeTick = component.durationSeconds();
      vi.advanceTimersByTime(5000);
      expect(component.durationSeconds()).toBe(durationBeforeTick);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should revoke the preview object URL when destroyed after recording', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    try {
      await component.startRecording();
      component.stopRecording();

      expect(component.audioPreviewUrl()).toBeTruthy();

      fixture.destroy();

      const previewUrl = component.audioPreviewUrl();
      if (previewUrl) {
        expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
      }
    } finally {
      revokeSpy.mockRestore();
    }
  });

  it('should upload voice note via media service and emit result URL', async () => {
    await component.startRecording();
    component.stopRecording();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(mediaService.uploadVoiceNote).toHaveBeenCalled();
    expect(emitted).toEqual(['https://media.url/voice.ogg']);
  });

  it('should preserve the recording for retry and never emit a fake URL when upload fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await component.startRecording();
      component.stopRecording();
      const previewUrl = component.audioPreviewUrl();
      const emitted: string[] = [];
      component.audioUploaded.subscribe((url: string) => emitted.push(url));
      mediaService.uploadVoiceNote.mockRejectedValueOnce(new Error('signed upload request failed'));

      await component.uploadAndSend();

      expect(emitted).toEqual([]);
      expect(component.audioPreviewUrl()).toBe(previewUrl);
      expect(component.isUploading()).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('Failed to upload voice note.');

      mediaService.uploadVoiceNote.mockResolvedValueOnce({ url: 'https://media.url/retry.ogg' });
      await component.uploadAndSend();

      expect(mediaService.uploadVoiceNote).toHaveBeenCalledTimes(2);
      expect(emitted).toEqual(['https://media.url/retry.ogg']);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should ignore duplicate send attempts while an upload is already in flight', async () => {
    await component.startRecording();
    component.stopRecording();

    let resolveUpload: ((value: { url: string }) => void) | undefined;
    mediaService.uploadVoiceNote.mockImplementationOnce(
      () =>
        new Promise<{ url: string }>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const firstUpload = component.uploadAndSend();
    const secondUpload = component.uploadAndSend();

    expect(component.isUploading()).toBe(true);
    expect(mediaService.uploadVoiceNote).toHaveBeenCalledTimes(1);

    resolveUpload?.({ url: 'https://media.url/voice.ogg' });
    await Promise.all([firstUpload, secondUpload]);

    expect(component.isUploading()).toBe(false);
  });
});
