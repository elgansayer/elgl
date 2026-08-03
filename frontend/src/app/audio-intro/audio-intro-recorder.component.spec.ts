import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { AudioIntroRecorderComponent } from './audio-intro-recorder.component';
import { AudioIntroService } from '../services/audio-intro.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockAudioIntroService {
  getAudioIntro = vi.fn().mockResolvedValue({ audio_url: null });
  updateAudioIntro = vi.fn().mockResolvedValue(undefined);
  getPresignedUploadUrl = vi
    .fn()
    .mockResolvedValue({ uploadUrl: 'upload-url', mediaUrl: 'media-url' });
  uploadAudioBlob = vi.fn().mockResolvedValue('media-url');
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

describe('AudioIntroRecorderComponent', () => {
  let component: AudioIntroRecorderComponent;
  let fixture: ComponentFixture<AudioIntroRecorderComponent>;
  let service: MockAudioIntroService;

  beforeEach(async () => {
    service = new MockAudioIntroService();

    const streamMock = {
      getTracks: () => [{ stop: () => {} }],
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
      providers: [{ provide: AudioIntroService, useValue: service }],
    })
      .overrideComponent(AudioIntroRecorderComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AudioIntroRecorderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'user-1');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load existing audio for the user', () => {
    expect(service.getAudioIntro).toHaveBeenCalledWith('user-1');
  });

  it('should render the translated title', () => {
    const title = fixture.nativeElement.querySelector('h2')?.textContent;
    expect(title).toContain('t:audioIntro.title');
  });
  it('should start and stop recording audio', async () => {
    await component.startRecording();
    expect(component.isRecording()).toBe(true);

    component.stopRecording();
    await vi.waitFor(() => expect(component.isRecording()).toBe(false));
  });

  it('should upload recorded audio and update audio intro URL', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });

    await component.uploadAudio(mockBlob);
    expect(service.uploadAudioBlob).toHaveBeenCalledWith(mockBlob);
    expect(component.audioIntroUrl()).toBe('media-url');
  });
});
