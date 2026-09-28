import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMediaMessageComponent } from './chat-media-message.component';

describe('ChatMediaMessageComponent', () => {
  let fixture: ComponentFixture<ChatMediaMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChatMediaMessageComponent] }).compileComponents();
    fixture = TestBed.createComponent(ChatMediaMessageComponent);
  });

  it('renders video_note messages as bounded circular video media', () => {
    fixture.componentRef.setInput('message', {
      message_type: 'video_note',
      media_url: 'https://cdn.example/video-note.webm',
    });
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(video).toBeTruthy();
    expect(video.className).toContain('rounded-full');
    expect(video.className).toContain('object-cover');
    expect(video.getAttribute('playsinline')).not.toBeNull();
    expect(video.getAttribute('controls')).not.toBeNull();
  });

  it('keeps ordinary shared videos rectangular', () => {
    fixture.componentRef.setInput('message', {
      message_type: 'video',
      media_url: 'https://cdn.example/video.mp4',
    });
    fixture.detectChanges();

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(video.className).toContain('rounded-xl');
    expect(video.className).not.toContain('rounded-full');
  });

  it('does not render unsafe media URLs', () => {
    fixture.componentRef.setInput('message', {
      message_type: 'video_note',
      media_url: 'javascript:alert(1)',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('video')).toBeNull();
  });
});
