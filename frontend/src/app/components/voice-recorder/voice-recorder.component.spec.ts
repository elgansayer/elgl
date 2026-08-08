import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { VoiceRecorderComponent } from './voice-recorder.component';
import { MediaService } from '../../services/media.service';
import { I18nService } from '../../services/i18n.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockMediaService {
  uploadVoiceNoteDirectToR2 = vi.fn().mockResolvedValue('https://r2.example.com/voice_notes/voice.webm');
  uploadVoiceNote = vi.fn().mockResolvedValue({ url: 'https://media.url/voice.ogg' });
}

class MockI18nService {
  translate = vi.fn().mockReturnValue('Mock error message');
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
      providers: [
        { provide: MediaService, useClass: MockMediaService },
        { provide: I18nService, useClass: MockI18nService },
      ],
    })
      .overrideComponent(VoiceRecorderComponent, {
        set: { imports: [MockTranslatePipe] },
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

  it('should start recording on pointerdown and stop on pointerup', async () => {
    vi.useFakeTimers();
    try {
      component.onRecordPointerDown(new PointerEvent('pointerdown'));
      fixture.detectChanges();

      expect(component.isRecording()).toBe(true);

      component.onRecordPointerUp();
      // onstop fires synchronously in mock
      expect(component.isRecording()).toBe(false);
      expect(component.audioPreviewUrl()).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop recording on pointerleave', async () => {
    vi.useFakeTimers();
    try {
      component.onRecordPointerDown(new PointerEvent('pointerdown'));
      expect(component.isRecording()).toBe(true);

      component.onRecordPointerLeave();
      expect(component.isRecording()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should upload via R2 direct upload and emit the URL', async () => {
    await component.startRecording();
    component.stopRecording();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(mediaService.uploadVoiceNoteDirectToR2).toHaveBeenCalled();
    expect(emitted).toEqual(['https://r2.example.com/voice_notes/voice.webm']);
  });

  it('should emit local preview URL as fallback when R2 upload fails', async () => {
    mediaService.uploadVoiceNoteDirectToR2 = vi.fn().mockRejectedValue(new Error('Upload failed'));

    await component.startRecording();
    component.stopRecording();
    const previewUrl = component.audioPreviewUrl();

    const emitted: string[] = [];
    component.audioUploaded.subscribe((url: string) => emitted.push(url));

    await component.uploadAndSend();

    expect(emitted).toEqual([previewUrl]);
  });

  it('should clean up preview URL on cancel', async () => {
    await component.startRecording();
    component.stopRecording();
    const previewUrl = component.audioPreviewUrl();

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    try {
      const emitted: unknown[] = [];
      component.cancelled.subscribe(() => emitted.push(true));

      component.cancel();

      expect(component.audioPreviewUrl()).toBeNull();
      expect(emitted.length).toBe(1);
      expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
    } finally {
      revokeSpy.mockRestore();
    }
  });
});
