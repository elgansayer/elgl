import { TestBed } from '@angular/core/testing';
import { ChatMediaMessageService } from '../../services/chat-media-message.service';
import { UploadedChatMedia } from '../../services/chat-media.service';
import { ChatMediaShareComponent } from './chat-media-share.component';

const media: UploadedChatMedia = {
  url: 'https://cdn.example/photo.webp',
  objectKey: 'chat/photo.webp',
  kind: 'image',
  quality: 'standard',
};

describe('ChatMediaShareComponent', () => {
  const send = vi.fn();

  function create() {
    TestBed.configureTestingModule({
      imports: [ChatMediaShareComponent],
      providers: [{ provide: ChatMediaMessageService, useValue: { send } }],
    });
    const fixture = TestBed.createComponent(ChatMediaShareComponent);
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('labels the share actions with translated copy', () => {
    const element = create().nativeElement as HTMLElement;

    expect(element.textContent).toContain('📷 Media');
    expect(element.textContent).toContain('🎥 Video note');
    expect(element.textContent).not.toContain('chatMedia.');
  });

  it('shows translated retry and dismiss controls when the message send fails', async () => {
    send.mockRejectedValue(new Error('offline'));
    const fixture = create();

    await fixture.componentInstance.onUploaded(media);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(fixture.componentInstance.sendError()).toBe(
      'Upload completed, but the message could not be sent.',
    );
    expect(text).toContain('Retry send');
    expect(text).toContain('Dismiss');
    expect(text).not.toContain('chatMedia.');
  });

  it('retries the pending upload and clears the error once it is sent', async () => {
    send.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const fixture = create();

    await fixture.componentInstance.onUploaded(media);
    await fixture.componentInstance.retryPending();

    expect(send).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.pendingMedia()).toBeNull();
    expect(fixture.componentInstance.sendError()).toBeNull();
  });
});
