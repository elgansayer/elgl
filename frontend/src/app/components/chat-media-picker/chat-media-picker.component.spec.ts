import { TestBed } from '@angular/core/testing';
import { ChatMediaPickerComponent } from './chat-media-picker.component';
import { ChatMediaService, UploadedChatMedia } from '../../services/chat-media.service';

describe('ChatMediaPickerComponent HD quality contract', () => {
  const chatMedia = { upload: vi.fn() };

  beforeEach(() => {
    chatMedia.upload.mockReset();
    TestBed.configureTestingModule({
      imports: [ChatMediaPickerComponent],
      providers: [{ provide: ChatMediaService, useValue: chatMedia }],
    });
  });

  it('defaults photo and video sharing to standard quality', () => {
    const fixture = TestBed.createComponent(ChatMediaPickerComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const checkbox = fixture.nativeElement.querySelector('hlm-checkbox');

    expect(component.quality()).toBe('standard');
    expect(checkbox).not.toBeNull();
    expect(checkbox.getAttribute('aria-label')).toBe('Send in HD quality');
  });

  it('switches between standard and HD without changing the selected media', () => {
    const fixture = TestBed.createComponent(ChatMediaPickerComponent);
    const component = fixture.componentInstance;
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    component.selectedFile.set(file);
    component.selectedKind.set('image');

    component.onQualityCheckedChange(true);
    expect(component.quality()).toBe('hd');
    expect(component.selectedFile()).toBe(file);
    expect(component.error()).toBeNull();

    component.onQualityCheckedChange(false);
    expect(component.quality()).toBe('standard');
    expect(component.selectedFile()).toBe(file);
  });

  it('uploads with the selected HD quality and emits the authoritative uploaded media', async () => {
    const fixture = TestBed.createComponent(ChatMediaPickerComponent);
    const component = fixture.componentInstance;
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const uploaded: UploadedChatMedia = {
      url: 'https://cdn.example/clip.mp4',
      objectKey: 'chat-media/user/video/hd/clip.mp4',
      kind: 'video',
      quality: 'hd',
    };
    chatMedia.upload.mockResolvedValue(uploaded);
    const emitted = vi.fn();
    component.uploaded.subscribe(emitted);
    component.selectedFile.set(file);
    component.selectedKind.set('video');
    component.onQualityCheckedChange(true);

    await component.upload();

    expect(chatMedia.upload).toHaveBeenCalledWith(file, 'hd');
    expect(emitted).toHaveBeenCalledWith(uploaded);
    expect(component.isUploading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('keeps the selected file and quality available for retry after an upload failure', async () => {
    const fixture = TestBed.createComponent(ChatMediaPickerComponent);
    const component = fixture.componentInstance;
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    chatMedia.upload.mockRejectedValue(new Error('Upload unavailable'));
    component.selectedFile.set(file);
    component.selectedKind.set('image');
    component.onQualityCheckedChange(true);

    await component.upload();

    expect(component.selectedFile()).toBe(file);
    expect(component.quality()).toBe('hd');
    expect(component.error()).toBe('Upload unavailable');
    expect(component.isUploading()).toBe(false);
  });
});
