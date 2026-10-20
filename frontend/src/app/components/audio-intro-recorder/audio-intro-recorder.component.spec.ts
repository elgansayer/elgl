import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UserService } from '../../services/user.service';
import { AudioIntroRecorderComponent } from './audio-intro-recorder.component';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

class MockUserService {
  getPresignedUploadUrl = vi.fn().mockResolvedValue({
    uploadUrl: 'https://uploads.example.test/intro',
    mediaUrl: 'https://media.example.test/audio/intro.webm',
  });
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
  let userService: MockUserService;
  let stopTrack: ReturnType<typeof vi.fn>;
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    stopTrack = vi.fn();
    createObjectUrl = vi.fn().mockReturnValue('blob:audio-intro-preview');
    revokeObjectUrl = vi.fn();

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
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

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
    userService = TestBed.inject(UserService) as unknown as MockUserService;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders only safe HTTP(S) persisted audio URLs', () => {
    fixture.componentRef.setInput('existingAudioUrl', 'https://media.example.test/intro.webm');
    fixture.detectChanges();

    expect(component.safeExistingAudioUrl()).toBe('https://media.example.test/intro.webm');
    expect(fixture.nativeElement.querySelector('audio')?.getAttribute('src')).toContain(
      'https://media.example.test/intro.webm',
    );

    fixture.componentRef.setInput('existingAudioUrl', 'javascript:alert(1)');
    fixture.detectChanges();

    expect(component.safeExistingAudioUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('audio')).toBeNull();
  });

  it('keeps a stopped recording local until the upload is persisted', async () => {
    const emitted = vi.fn();
    component.recordingComplete.subscribe(emitted);

    await component.startRecording();
    component.stopRecording();

    expect(component.isRecording()).toBe(false);
    expect(component.hasRecording()).toBe(true);
    expect(component.recordingUrl()).toBe('blob:audio-intro-preview');
    expect(emitted).not.toHaveBeenCalled();
    expect(userService.updateMyProfile).not.toHaveBeenCalled();
  });

  it('auto-stops once at the 30 second limit and does not keep ticking afterwards', async () => {
    vi.useFakeTimers();
    await component.startRecording();

    vi.advanceTimersByTime(30_000);

    expect(component.isRecording()).toBe(false);
    expect(component.duration()).toBe(30);
    const stoppedDuration = component.duration();
    vi.advanceTimersByTime(10_000);
    expect(component.duration()).toBe(stoppedDuration);
  });

  it('stops the media stream and timer when destroyed mid-recording', async () => {
    vi.useFakeTimers();
    await component.startRecording();
    expect(component.isRecording()).toBe(true);

    fixture.destroy();

    expect(stopTrack).toHaveBeenCalled();
    const durationBeforeTick = component.duration();
    vi.advanceTimersByTime(5000);
    expect(component.duration()).toBe(durationBeforeTick);
  });

  it('emits the durable media URL only after upload and profile persistence succeed', async () => {
    const emitted = vi.fn();
    component.recordingComplete.subscribe(emitted);
    await component.startRecording();
    component.stopRecording();

    await component.uploadRecording();

    expect(fetch).toHaveBeenCalledWith(
      'https://uploads.example.test/intro',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(userService.updateMyProfile).toHaveBeenCalledWith({
      audio_intro_url: 'https://media.example.test/audio/intro.webm',
    });
    expect(emitted).toHaveBeenCalledWith('https://media.example.test/audio/intro.webm');
    expect(component.hasRecording()).toBe(false);
    expect(component.recordingBlob()).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:audio-intro-preview');
  });

  it('retains the local recording after an upload failure so retry is possible', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const emitted = vi.fn();
    component.recordingComplete.subscribe(emitted);
    await component.startRecording();
    component.stopRecording();

    await component.uploadRecording();

    expect(component.hasRecording()).toBe(true);
    expect(component.recordingBlob()).not.toBeNull();
    expect(component.recordError()).toBe('common.error_generic');
    expect(userService.updateMyProfile).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent upload attempts', async () => {
    let resolveUpload!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    await component.startRecording();
    component.stopRecording();

    const first = component.uploadRecording();
    const second = component.uploadRecording();

    expect(userService.getPresignedUploadUrl).toHaveBeenCalledTimes(1);
    resolveUpload({ ok: true } as Response);
    await Promise.all([first, second]);
    expect(userService.updateMyProfile).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the backend returns an unsafe upload or media URL', async () => {
    userService.getPresignedUploadUrl.mockResolvedValueOnce({
      uploadUrl: 'javascript:alert(1)',
      mediaUrl: 'data:audio/webm;base64,AAAA',
    });
    await component.startRecording();
    component.stopRecording();

    await component.uploadRecording();

    expect(fetch).not.toHaveBeenCalled();
    expect(userService.updateMyProfile).not.toHaveBeenCalled();
    expect(component.hasRecording()).toBe(true);
    expect(component.recordError()).toBe('common.error_generic');
  });
});
