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
  mimeType = 'audio/webm';
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
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

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

    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice-preview');
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [VoiceRecorderComponent],
      providers: [{ provide: MediaService, useClass: MockMediaService }],
    })
      .overrideComponent(VoiceRecorderComponent, {
        set: {
          imports: [MockTranslatePipe, AppCardComponent, AppChipComponent, AppButtonPrimaryComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
    mediaService = TestBed.inject(MediaService) as unknown as MockMediaService;
    fixture.detectChanges();
  });

  afterEach(() => {
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('records while a primary pointer is held and stops on release', async () => {
    const capture = vi.fn();
    const target = document.createElement('button');
    target.setPointerCapture = capture;
    const down = {
      button: 0,
      pointerId: 7,
      currentTarget: target,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;

    await component.onRecordPointerDown(down);

    expect(component.isRecording()).toBe(true);
    expect(capture).toHaveBeenCalledWith(7);

    component.onRecordPointerUp({
      pointerId: 7,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    expect(component.isRecording()).toBe(false);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
  });

  it('supports keyboard press-and-release recording without relying on pointer input', async () => {
    const down = {
      key: ' ',
      repeat: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    component.onRecordKeyDown(down);
    await fixture.whenStable();

    expect(component.isRecording()).toBe(true);

    component.onRecordKeyUp({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent);

    expect(component.isRecording()).toBe(false);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
  });

  it('stops a recording when the press is released before microphone permission resolves', async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const lateStopTrack = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(pendingStream);

    const target = document.createElement('button');
    target.setPointerCapture = vi.fn();
    const hold = component.onRecordPointerDown({
      button: 0,
      pointerId: 11,
      currentTarget: target,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    component.onRecordPointerUp({
      pointerId: 11,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    resolveStream({ getTracks: () => [{ stop: lateStopTrack }] } as unknown as MediaStream);
    await hold;

    expect(component.isRecording()).toBe(false);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
    expect(lateStopTrack).toHaveBeenCalled();
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
    await component.startRecording();
    component.stopRecording();

    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');

    fixture.destroy();

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:voice-preview');
  });

  it('should upload voice note via media service and emit only the persisted result URL', async () => {
    await component.startRecording();
    component.stopRecording();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(mediaService.uploadVoiceNote).toHaveBeenCalledWith(expect.any(Blob), 'ogg');
    expect(emitted).toEqual(['https://media.url/voice.ogg']);
    expect(component.audioPreviewUrl()).toBeNull();
  });

  it('does not emit a fictional media URL when upload fails and keeps the preview retryable', async () => {
    await component.startRecording();
    component.stopRecording();
    mediaService.uploadVoiceNote.mockRejectedValueOnce(new Error('provider unavailable'));
    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(emitted).toEqual([]);
    expect(component.audioPreviewUrl()).toBe('blob:voice-preview');
    expect(component.isUploading()).toBe(false);
  });

  it('suppresses duplicate uploads while a send is already in flight', async () => {
    let resolveUpload!: (result: { url: string }) => void;
    mediaService.uploadVoiceNote.mockReturnValueOnce(
      new Promise<{ url: string }>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await component.startRecording();
    component.stopRecording();

    const first = component.uploadAndSend();
    const second = component.uploadAndSend();

    expect(mediaService.uploadVoiceNote).toHaveBeenCalledTimes(1);
    resolveUpload({ url: 'https://media.url/voice.ogg' });
    await Promise.all([first, second]);
  });
});
