import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioIntroFeedComponent } from './audio-intro-feed.component';
import { I18nService } from '../../services/i18n.service';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('AudioIntroFeedComponent', () => {
  let component: AudioIntroFeedComponent;
  let fixture: ComponentFixture<AudioIntroFeedComponent>;

  beforeEach(async () => {
    const i18nServiceMock = {
      translate: (key: string, params?: Record<string, unknown>) => {
        if (params) return key + ' ' + JSON.stringify(params);
        return key;
      },
      translations: signal({}) as unknown as I18nService['translations'],
    };

    await TestBed.configureTestingModule({
      imports: [AudioIntroFeedComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioIntroFeedComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have signal inputs with default values', async () => {
    await fixture.whenStable();
    expect(component.users()).toEqual([]);
    expect(component.isLoading()).toBe(false);
    expect(component.emptyMessageKey()).toBe('discovery.audioIntroFeed.noAudioIntros');
  });

  it('should render empty state by default', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('discovery.audioIntroFeed.noAudioIntros');
  });

  it('should not play if audio_intro_url is undefined', () => {
    component.togglePlay('u1', undefined, new Event('click'));
    expect(component.playingId()).toBeNull();
  });

  it('should toggle audio play/pause', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();

    const origAudio = window.Audio;
    class MockAudio {
      play = playSpy;
      pause = pauseSpy;
      addEventListener = vi.fn();
      load = vi.fn();
      currentTime = 0;
      src = '';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
    }
    (window as unknown as Record<string, unknown>)['Audio'] = MockAudio;

    expect(component.playingId()).toBeNull();

    component.togglePlay('u1', 'https://example.com/audio.mp3', new Event('click'));
    expect(component.playingId()).toBe('u1');
    expect(playSpy).toHaveBeenCalled();

    component.togglePlay('u1', 'https://example.com/audio.mp3', new Event('click'));
    expect(component.playingId()).toBeNull();
    expect(pauseSpy).toHaveBeenCalled();

    (window as unknown as Record<string, unknown>)['Audio'] = origAudio;
  });

  it('should expose userList computed signal', () => {
    // userList is a computed that mirrors users input
    expect(component.userList()).toEqual([]);
  });

  it('should provide getFlag method returning language flag', () => {
    const flag = component.getFlag('gb');
    expect(typeof flag).toBe('string');
    expect(flag.length).toBeGreaterThan(0);
  });
});
