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

class MockUserService {}

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

describe('AudioIntroRecorderComponent rerecord resilience', () => {
  let component: AudioIntroRecorderComponent;
  let fixture: ComponentFixture<AudioIntroRecorderComponent>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const streamMock = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;

    getUserMedia = vi.fn().mockResolvedValue(streamMock);
    revokeObjectUrl = vi.fn();

    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      configurable: true,
      value: MockedMediaRecorder,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:previous-audio-intro'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
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

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('preserves the previous local take when microphone permission fails during rerecord', async () => {
    await component.startRecording();
    component.stopRecording();

    const previousBlob = component.recordingBlob();
    expect(previousBlob).not.toBeNull();
    expect(component.recordingUrl()).toBe('blob:previous-audio-intro');

    getUserMedia.mockRejectedValueOnce(new Error('permission-denied'));
    await component.startRecording();

    expect(component.isRecording()).toBe(false);
    expect(component.hasRecording()).toBe(true);
    expect(component.recordingBlob()).toBe(previousBlob);
    expect(component.recordingUrl()).toBe('blob:previous-audio-intro');
    expect(revokeObjectUrl).not.toHaveBeenCalledWith('blob:previous-audio-intro');
    expect(component.recordError()).toBe('common.error_generic');
  });

  it('replaces the previous local take only after the new recorder starts successfully', async () => {
    await component.startRecording();
    component.stopRecording();

    expect(component.hasRecording()).toBe(true);
    expect(component.recordingUrl()).toBe('blob:previous-audio-intro');

    await component.startRecording();

    expect(component.isRecording()).toBe(true);
    expect(component.hasRecording()).toBe(false);
    expect(component.recordingBlob()).toBeNull();
    expect(component.recordingUrl()).toBe('');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:previous-audio-intro');
  });
});
