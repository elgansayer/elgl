import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMediaService, UploadedChatMedia } from '../../services/chat-media.service';
import { InstantVideoRecorderComponent } from './instant-video-recorder.component';

type RecorderHarness = { recordedBlob: Blob | null };

describe('InstantVideoRecorderComponent', () => {
  let fixture: ComponentFixture<InstantVideoRecorderComponent>;
  let component: InstantVideoRecorderComponent;
  const upload = vi.fn();

  beforeEach(async () => {
    upload.mockReset();
    await TestBed.configureTestingModule({
      imports: [InstantVideoRecorderComponent],
      providers: [{ provide: ChatMediaService, useValue: { upload } }],
    }).compileComponents();

    fixture = TestBed.createComponent(InstantVideoRecorderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('bounds the visible recording timer to the 30 second product limit', () => {
    expect(component.formatDuration(-4)).toBe('00:00');
    expect(component.formatDuration(7.9)).toBe('00:07');
    expect(component.formatDuration(30)).toBe('00:30');
    expect(component.formatDuration(90)).toBe('00:30');
  });

  it('uploads a recorded clip as standard video and emits instant-video presentation', async () => {
    const uploaded: UploadedChatMedia = {
      url: 'https://cdn.example/note.webm',
      objectKey: 'chat-media/user-1/video/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.webm',
      kind: 'video',
      quality: 'standard',
    };
    upload.mockResolvedValue(uploaded);
    (component as unknown as RecorderHarness).recordedBlob = new Blob(['video'], {
      type: 'video/webm;codecs=vp8,opus',
    });

    let emitted: UploadedChatMedia | undefined;
    component.uploaded.subscribe((value) => (emitted = value));
    await component.uploadAndSend();

    expect(upload).toHaveBeenCalledTimes(1);
    const [file, quality] = upload.mock.calls[0] as [File, string];
    expect(file.type).toBe('video/webm');
    expect(quality).toBe('standard');
    expect(emitted).toEqual({ ...uploaded, presentation: 'instant_video' });
    expect(component.errorMessage()).toBeNull();
  });

  it('keeps the local recording available when upload fails', async () => {
    upload.mockRejectedValue(new Error('R2 unavailable'));
    const blob = new Blob(['video'], { type: 'video/webm' });
    (component as unknown as RecorderHarness).recordedBlob = blob;

    await component.uploadAndSend();

    expect((component as unknown as RecorderHarness).recordedBlob).toBe(blob);
    expect(component.errorMessage()).toContain('still here to retry');
    expect(component.isUploading()).toBe(false);
  });

  it('does not attempt an upload when no recording exists', async () => {
    await component.uploadAndSend();
    expect(upload).not.toHaveBeenCalled();
  });
});
