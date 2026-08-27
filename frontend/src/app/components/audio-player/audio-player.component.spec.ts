import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { AudioPlayerComponent } from './audio-player.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('AudioPlayerComponent', () => {
  let component: AudioPlayerComponent;
  let fixture: ComponentFixture<AudioPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioPlayerComponent],
    })
      .overrideComponent(AudioPlayerComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AudioPlayerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('src', 'https://example.com/voice.mp3');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const getAudioEl = () => fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
  const getButton = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  const getRange = () => fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate a deterministic waveform of peaks between 0 and 1 as a fallback', () => {
    expect(component['peaks']().length).toBe(40);
    for (const peak of component['peaks']()) {
      expect(peak).toBeGreaterThanOrEqual(0);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  it('should render a play button initially with a play label', () => {
    expect(getButton().getAttribute('aria-label')).toBe('audioPlayer.play');
  });

  it('should toggle to a pause label when the underlying audio element starts playing', () => {
    getAudioEl().dispatchEvent(new Event('play'));
    fixture.detectChanges();
    expect(getButton().getAttribute('aria-label')).toBe('audioPlayer.pause');
    expect(component['isPlaying']()).toBe(true);
  });

  it('should revert to a play label when the audio pauses', () => {
    getAudioEl().dispatchEvent(new Event('play'));
    fixture.detectChanges();
    getAudioEl().dispatchEvent(new Event('pause'));
    fixture.detectChanges();
    expect(getButton().getAttribute('aria-label')).toBe('audioPlayer.play');
    expect(component['isPlaying']()).toBe(false);
  });

  it('should use the durationSec hint before real metadata has loaded', () => {
    fixture.componentRef.setInput('durationSec', 42);
    fixture.detectChanges();
    expect(component['formattedDuration']()).toBe('0:42');
  });

  it('should adopt the real duration once loadedmetadata fires', () => {
    Object.defineProperty(getAudioEl(), 'duration', { value: 65, configurable: true });
    getAudioEl().dispatchEvent(new Event('loadedmetadata'));
    fixture.detectChanges();
    expect(component['duration']()).toBe(65);
    expect(component['formattedDuration']()).toBe('1:05');
  });

  it('should update the timestamp as playback progresses', () => {
    Object.defineProperty(getAudioEl(), 'currentTime', { value: 12, configurable: true });
    getAudioEl().dispatchEvent(new Event('timeupdate'));
    fixture.detectChanges();
    expect(component['currentTime']()).toBe(12);
    expect(component['formattedCurrentTime']()).toBe('0:12');
  });

  it('should reset to the start when playback ends', () => {
    Object.defineProperty(getAudioEl(), 'currentTime', { value: 12, configurable: true });
    getAudioEl().dispatchEvent(new Event('timeupdate'));
    getAudioEl().dispatchEvent(new Event('play'));
    fixture.detectChanges();
    getAudioEl().dispatchEvent(new Event('ended'));
    fixture.detectChanges();
    expect(component['isPlaying']()).toBe(false);
    expect(component['currentTime']()).toBe(0);
  });

  it('should seek the underlying audio element when the range slider changes', () => {
    fixture.componentRef.setInput('durationSec', 100);
    fixture.detectChanges();
    const range = getRange();
    range.value = '30';
    range.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component['currentTime']()).toBe(30);
  });

  it('should show an error state and disable the button when the audio fails to load', () => {
    getAudioEl().dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(component['hasError']()).toBe(true);
    expect(getButton().disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('audioPlayer.error');
  });
});
