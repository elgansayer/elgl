import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { VoiceRecorderComponent } from './voice-recorder.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

import { MediaService } from '../../services/media.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockMediaService {
  uploadVoiceNote = vi.fn().mockResolvedValue({ url: 'https://media.url/voice.webm' });
}

class MockedMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);

  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['audio'], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.();
  }
}

describe('VoiceRecorderComponent', () => {
  let component: VoiceRecorderComponent;
  let fixture: ComponentFixture<VoiceRecorderComponent>;
  let stopTrack: ReturnType<typeof vi.fn>;
  let mediaService: MockMediaService;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let streamMock: MediaStream;

  beforeEach(async () => {
    stopTrack = vi.fn();
    streamMock = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(streamMock);

    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      configurable: true,
      value: MockedMediaRecorder,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn().mockReturnValue('blob:voice-preview'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-preview');
    }

    await TestBed.configureTestingModule({
      imports: [VoiceRecorderComponent],
      providers: [{ provide: MediaService, useClass: MockMediaService }],
    })
      .overrideComponent(VoiceRecorderComponent, {
        set: {
          imports: [MockTranslatePipe, AppCardComponent, AppButtonPrimaryComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
    mediaService = TestBed.inject(MediaService) as unknown as MockMediaService;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('records a bounded audio preview and releases the microphone on stop', async () => {
    await component.startRecording();

    expect(component.isRecording()).toBe(true);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    component.stopRecording();

    expect(component.isRecording()).toBe(false);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('automatically stops after two minutes', async () => {
    vi.useFakeTimers();
    await component.startRecording();

    vi.advanceTimersByTime(120_000);

    expect(component.durationSeconds()).toBe(120);
    expect(component.isRecording()).toBe(false);
    expect(stopTrack).toHaveBeenCalled();
  });

  it('cancels a pending hold if the user releases before microphone permission resolves', async () => {
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    );

    component.onRecordKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.isPreparing()).toBe(true);

    component.onRecordKeyUp(new KeyboardEvent('keyup', { key: ' ' }));
    expect(component.isPreparing()).toBe(false);

    resolveStream?.(streamMock);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.isRecording()).toBe(false);
    expect(stopTrack).toHaveBeenCalled();
  });

  it('shows a microphone error without fabricating a recording', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('permission denied'));

    await component.startRecording();

    expect(component.errorKey()).toBe('audioIntro.microphoneError');
    expect(component.isRecording()).toBe(false);
    expect(component.audioPreviewUrl()).toBeNull();
  });

  it('uploads through MediaService and emits only the persisted media URL', async () => {
    await component.startRecording();
    component.stopRecording();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(mediaService.uploadVoiceNote).toHaveBeenCalledWith(expect.any(Blob));
    expect(emitted).toEqual(['https://media.url/voice.webm']);
    expect(component.errorKey()).toBeNull();
  });

  it('keeps the preview retryable and never emits a mock URL when upload fails', async () => {
    mediaService.uploadVoiceNote.mockRejectedValueOnce(new Error('network failure'));
    await component.startRecording();
    component.stopRecording();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(emitted).toEqual([]);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
    expect(component.errorKey()).toBe('audioIntro.uploadError');
    expect(component.isUploading()).toBe(false);
  });

  it('stops the media stream and clears the timer when destroyed mid-recording', async () => {
    vi.useFakeTimers();
    await component.startRecording();
    expect(component.isRecording()).toBe(true);

    fixture.destroy();

    expect(stopTrack).toHaveBeenCalled();
    const durationBeforeTick = component.durationSeconds();
    vi.advanceTimersByTime(5000);
    expect(component.durationSeconds()).toBe(durationBeforeTick);
  });

  it('revokes the preview object URL when cancelled', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await component.startRecording();
    component.stopRecording();

    component.cancel();

    expect(revokeSpy).toHaveBeenCalledWith('blob:voice-preview');
    expect(component.audioPreviewUrl()).toBeNull();
  });
});
