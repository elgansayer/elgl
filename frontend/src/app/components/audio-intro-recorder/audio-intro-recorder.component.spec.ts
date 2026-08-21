import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { AudioIntroRecorderComponent } from './audio-intro-recorder.component';
import { UserService } from '../../services/user.service';

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
  updateMyProfile = vi.fn().mockResolvedValue(undefined);
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

describe('AudioIntroRecorderComponent', () => {
  let component: AudioIntroRecorderComponent;
  let fixture: ComponentFixture<AudioIntroRecorderComponent>;
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
      imports: [AudioIntroRecorderComponent],
      providers: [{ provide: UserService, useClass: MockUserService }],
    })
      .overrideComponent(AudioIntroRecorderComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AudioIntroRecorderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start and stop recording with rxjs interval timer', async () => {
    vi.useFakeTimers();
    try {
      await component.startRecording();
      expect(component.isRecording()).toBe(true);

      component.stopRecording();
      await vi.waitFor(() => expect(component.isRecording()).toBe(false));
      expect(component.hasRecording()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should auto-stop after 30 seconds', async () => {
    vi.useFakeTimers();
    try {
      await component.startRecording();
      expect(component.isRecording()).toBe(true);

      // Advance 30 seconds
      vi.advanceTimersByTime(31000);
      await vi.waitFor(() => expect(component.isRecording()).toBe(false));
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop media stream and clean up timer when destroyed mid-recording', async () => {
    vi.useFakeTimers();
    try {
      await component.startRecording();
      expect(component.isRecording()).toBe(true);

      fixture.destroy();

      expect(stopTrack).toHaveBeenCalled();

      const durationBeforeTick = component.duration();
      vi.advanceTimersByTime(5000);
      expect(component.duration()).toBe(durationBeforeTick);
    } finally {
      vi.useRealTimers();
    }
  });
});
