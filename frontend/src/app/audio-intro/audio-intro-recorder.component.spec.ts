import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioIntroRecorderComponent } from './audio-intro-recorder.component';
import { AudioIntroService } from '../services/audio-intro.service';
import { TranslatePipe } from '../services/translate.pipe';

class MockTranslatePipe {
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

describe('AudioIntroRecorderComponent', () => {
  let component: AudioIntroRecorderComponent;
  let fixture: ComponentFixture<AudioIntroRecorderComponent>;
  let service: MockAudioIntroService;

  beforeEach(async () => {
    service = new MockAudioIntroService();
    await TestBed.configureTestingModule({
      imports: [AudioIntroRecorderComponent],
      providers: [
        { provide: AudioIntroService, useValue: service },
        { provide: TranslatePipe, useClass: MockTranslatePipe },
      ],
    }).compileComponents();

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
});
