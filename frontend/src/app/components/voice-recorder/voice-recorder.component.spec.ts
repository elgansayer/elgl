import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { VoiceRecorderComponent } from './voice-recorder.component';
import { UserService } from '../../services/user.service';
import { AudioCompressionService } from '../../services/audio-compression.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockUserService {
  getPresignedUploadUrl = vi
    .fn()
    .mockResolvedValue({ uploadUrl: 'http://mock-upload-url', mediaUrl: 'media-url' });
}

class MockAudioCompressionService {
  compressAudio = vi.fn().mockImplementation((blob: Blob) => Promise.resolve(blob));
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
        { provide: UserService, useClass: MockUserService },
        { provide: AudioCompressionService, useClass: MockAudioCompressionService },
      ],
    })
      .overrideComponent(VoiceRecorderComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VoiceRecorderComponent);
    component = fixture.componentInstance;
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

      expect(revokeSpy).toHaveBeenCalledWith(component.audioPreviewUrl());
    } finally {
      revokeSpy.mockRestore();
    }
  });
});
