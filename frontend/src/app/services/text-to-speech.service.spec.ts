import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TextToSpeechService } from './text-to-speech.service';
import { I18nService } from './i18n.service';

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak, cancel },
    });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      function (this: { text: string; lang?: string; rate?: number }, text: string) {
        this.text = text;
      };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    });
    service = TestBed.inject(TextToSpeechService);
  });

  it('does nothing for blank text', () => {
    service.speak('id-1', '   ');
    expect(speak).not.toHaveBeenCalled();
  });

  it('cancels any in-flight utterance and speaks the given text', () => {
    service.speak('id-1', 'Hello there');

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: 'Hello there' });
  });

  it('marks the id as speaking once the utterance starts', () => {
    service.speak('id-1', 'Hello there');
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void };
    utterance.onstart?.();

    expect(service.isSpeaking('id-1')).toBe(true);
    expect(service.speakingId()).toBe('id-1');
  });

  it('clears the speaking id once the utterance ends', () => {
    service.speak('id-1', 'Hello there');
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void; onend?: () => void };
    utterance.onstart?.();
    utterance.onend?.();

    expect(service.isSpeaking('id-1')).toBe(false);
    expect(service.speakingId()).toBeNull();
  });

  it('stop cancels playback and clears the speaking id', () => {
    service.speak('id-1', 'Hello there');
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void };
    utterance.onstart?.();

    service.stop();

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(service.speakingId()).toBeNull();
  });

  it('toggle stops playback when already speaking the given id', () => {
    service.speak('id-1', 'Hello there');
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void };
    utterance.onstart?.();

    service.toggle('id-1', 'Hello there');

    expect(service.speakingId()).toBeNull();
  });

  it('toggle starts playback when not already speaking the given id', () => {
    service.toggle('id-1', 'Hello there');

    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('shows an unsupported toast when speechSynthesis is unavailable', () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;

    service.speak('id-1', 'Hello there');

    expect(speak).not.toHaveBeenCalled();
  });
});
