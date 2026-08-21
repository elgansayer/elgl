import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { MediaAttachmentsComponent, MultiMediaMessage } from './media-attachments.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('MediaAttachmentsComponent', () => {
  let component: MediaAttachmentsComponent;
  let fixture: ComponentFixture<MediaAttachmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaAttachmentsComponent],
    })
      .overrideComponent(MediaAttachmentsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MediaAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('message', { text: 'hello' } satisfies MultiMediaMessage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render text only', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('hello');
  });

  it('should render images grid', () => {
    fixture.componentRef.setInput('message', {
      images: ['a.jpg', 'b.jpg'],
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs.length).toBe(2);
  });

  it('should not render text paragraph when text is absent', () => {
    fixture.componentRef.setInput('message', {
      images: ['a.jpg'],
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')).toBeNull();
  });

  it('should cap the images grid at 9 images', () => {
    fixture.componentRef.setInput('message', {
      images: Array.from({ length: 12 }, (_, i) => `${i}.jpg`),
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    expect(component.images().length).toBe(9);
    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs.length).toBe(9);
  });

  it('should set the src and alt attributes on each rendered image', () => {
    fixture.componentRef.setInput('message', {
      images: ['a.jpg'],
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('a.jpg');
    expect(img.alt).toBe('media.image');
  });

  it('should render a voice note with an audio player showing its duration', async () => {
    fixture.componentRef.setInput('message', {
      voiceNote: { url: 'voice.mp3', durationSec: 42 },
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    expect(audio).toBeTruthy();
    expect(audio.src).toContain('voice.mp3');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0:42');
  });

  it('should not render the images grid when a voice note is present', () => {
    fixture.componentRef.setInput('message', {
      images: ['a.jpg', 'b.jpg'],
      voiceNote: { url: 'voice.mp3', durationSec: 10 },
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    expect(component.showImages()).toBe(false);
    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs.length).toBe(0);
  });

  it('should render text alongside a voice note', () => {
    fixture.componentRef.setInput('message', {
      text: 'listen to this',
      voiceNote: { url: 'voice.mp3', durationSec: 5 },
    } satisfies MultiMediaMessage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('listen to this');
    expect(compiled.querySelector('audio')).toBeTruthy();
  });

  it('should render nothing when the message is empty', () => {
    fixture.componentRef.setInput('message', {} satisfies MultiMediaMessage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')).toBeNull();
    expect(compiled.querySelector('audio')).toBeNull();
    expect(compiled.querySelectorAll('img').length).toBe(0);
  });
});
