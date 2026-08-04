import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextToSpeechComponent } from './text-to-speech.component';
import { I18nService } from '../../services/i18n.service';

describe('TextToSpeechComponent', () => {
  let component: TextToSpeechComponent;
  let fixture: ComponentFixture<TextToSpeechComponent>;
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
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

    await TestBed.configureTestingModule({
      imports: [TextToSpeechComponent],
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(TextToSpeechComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', 'Hello there');
    fixture.componentRef.setInput('language', 'en-GB');
    fixture.detectChanges();
  });

  it('creates in the not-speaking state', () => {
    expect(component).toBeTruthy();
    expect(component.isSpeaking()).toBe(false);
  });

  it('starts speaking when toggled', () => {
    component.toggleSpeech();

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void; lang?: string };
    expect(utterance.lang).toBe('en-GB');

    utterance.onstart?.();
    fixture.detectChanges();
    expect(component.isSpeaking()).toBe(true);
  });

  it('stops speaking when toggled again', () => {
    component.toggleSpeech();
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void };
    utterance.onstart?.();
    fixture.detectChanges();

    component.toggleSpeech();

    expect(cancel).toHaveBeenCalled();
    expect(component.isSpeaking()).toBe(false);
  });

  it('cancels speech synthesis when destroyed while speaking', () => {
    component.toggleSpeech();
    const utterance = speak.mock.calls[0][0] as { onstart?: () => void };
    utterance.onstart?.();
    fixture.detectChanges();

    fixture.destroy();

    expect(cancel).toHaveBeenCalled();
  });
});
