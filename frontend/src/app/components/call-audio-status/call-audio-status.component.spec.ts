import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallAudioStatusComponent } from './call-audio-status.component';
import {
  CallAudioDeviceNotice,
  CallAudioSessionService,
} from '../../services/call-audio-session.service';
import { I18nService } from '../../services/i18n.service';

describe('CallAudioStatusComponent', () => {
  let fixture: ComponentFixture<CallAudioStatusComponent>;
  let playbackBlocked: ReturnType<typeof signal<boolean>>;
  let microphoneInterrupted: ReturnType<typeof signal<boolean>>;
  let deviceNotice: ReturnType<typeof signal<CallAudioDeviceNotice | null>>;
  let audioSession: {
    playbackBlocked: ReturnType<typeof signal<boolean>>;
    microphoneInterrupted: ReturnType<typeof signal<boolean>>;
    deviceNotice: ReturnType<typeof signal<CallAudioDeviceNotice | null>>;
    resumePlayback: ReturnType<typeof vi.fn>;
    recoverMicrophone: ReturnType<typeof vi.fn>;
    dismissMicrophoneNotice: ReturnType<typeof vi.fn>;
    dismissDeviceNotice: ReturnType<typeof vi.fn>;
  };

  const text = (testId: string): string =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';

  const byTestId = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  const buttonLabelled = (label: string): HTMLButtonElement => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const match = buttons.find((button) => button.textContent?.trim() === label);
    if (!match) {
      throw new Error(`No button labelled ${label}`);
    }
    return match;
  };

  beforeEach(async () => {
    playbackBlocked = signal(false);
    microphoneInterrupted = signal(false);
    deviceNotice = signal<CallAudioDeviceNotice | null>(null);
    audioSession = {
      playbackBlocked,
      microphoneInterrupted,
      deviceNotice,
      resumePlayback: vi.fn().mockResolvedValue(true),
      recoverMicrophone: vi.fn().mockResolvedValue(true),
      dismissMicrophoneNotice: vi.fn(),
      dismissDeviceNotice: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CallAudioStatusComponent],
      providers: [
        { provide: CallAudioSessionService, useValue: audioSession },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) =>
              params ? `${key}|${JSON.stringify(params)}` : key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CallAudioStatusComponent);
    fixture.detectChanges();
  });

  describe('when everything works', () => {
    it('shows no message', () => {
      expect(byTestId('call-audio-playback-blocked')).toBeNull();
      expect(byTestId('call-audio-microphone-interrupted')).toBeNull();
      expect(byTestId('call-audio-device-notice')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    });

    it('keeps its live regions in the document so later messages are announced', () => {
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    });

    it('lets pointer events through the empty banner area', () => {
      const wrapper: HTMLElement = fixture.nativeElement.firstElementChild;

      expect(wrapper.classList.contains('pointer-events-none')).toBe(true);
    });
  });

  describe('when the browser blocks sound', () => {
    beforeEach(() => {
      playbackBlocked.set(true);
      fixture.detectChanges();
    });

    it('explains that the other person cannot be heard yet', () => {
      expect(text('call-audio-playback-blocked')).toContain('callAudio.playbackBlocked');
    });

    it('announces the message as an alert', () => {
      const alert = fixture.nativeElement.querySelector('[role="alert"]');

      expect(alert.contains(byTestId('call-audio-playback-blocked'))).toBe(true);
    });

    it('turns the sound on from the button', () => {
      buttonLabelled('callAudio.playbackResume').click();

      expect(audioSession.resumePlayback).toHaveBeenCalledTimes(1);
    });

    it('takes priority over a microphone message', () => {
      microphoneInterrupted.set(true);
      fixture.detectChanges();

      expect(byTestId('call-audio-playback-blocked')).not.toBeNull();
      expect(byTestId('call-audio-microphone-interrupted')).toBeNull();
    });

    it('goes away once sound is restored', () => {
      playbackBlocked.set(false);
      fixture.detectChanges();

      expect(byTestId('call-audio-playback-blocked')).toBeNull();
    });
  });

  describe('when the microphone stops working', () => {
    beforeEach(() => {
      microphoneInterrupted.set(true);
      fixture.detectChanges();
    });

    it('tells the person others may not hear them', () => {
      expect(text('call-audio-microphone-interrupted')).toContain(
        'callAudio.microphoneInterrupted',
      );
    });

    it('announces the message as an alert', () => {
      const alert = fixture.nativeElement.querySelector('[role="alert"]');

      expect(alert.contains(byTestId('call-audio-microphone-interrupted'))).toBe(true);
    });

    it('reconnects the microphone from the button', async () => {
      buttonLabelled('callAudio.microphoneReconnect').click();
      await fixture.whenStable();

      expect(audioSession.recoverMicrophone).toHaveBeenCalledTimes(1);
    });

    it('disables the button and marks it busy while reconnecting', async () => {
      let finish: (value: boolean) => void = () => undefined;
      audioSession.recoverMicrophone.mockReturnValue(
        new Promise<boolean>((resolve) => (finish = resolve)),
      );

      buttonLabelled('callAudio.microphoneReconnect').click();
      fixture.detectChanges();

      const busy = buttonLabelled('callAudio.microphoneReconnect');
      expect(busy.disabled).toBe(true);
      expect(busy.getAttribute('aria-busy')).toBe('true');

      finish(true);
      await fixture.whenStable();
      fixture.detectChanges();

      const idle = buttonLabelled('callAudio.microphoneReconnect');
      expect(idle.disabled).toBe(false);
      expect(idle.hasAttribute('aria-busy')).toBe(false);
    });

    it('ignores a second activation while reconnecting', async () => {
      let finish: (value: boolean) => void = () => undefined;
      audioSession.recoverMicrophone.mockReturnValue(
        new Promise<boolean>((resolve) => (finish = resolve)),
      );
      const component = fixture.componentInstance;

      const first = component.reconnectMicrophone();
      const second = component.reconnectMicrophone();
      finish(true);
      await Promise.all([first, second]);

      expect(audioSession.recoverMicrophone).toHaveBeenCalledTimes(1);
    });

    it('can reconnect again after a failed attempt', async () => {
      audioSession.recoverMicrophone.mockRejectedValueOnce(new Error('busy'));
      const component = fixture.componentInstance;

      await expect(component.reconnectMicrophone()).rejects.toThrow('busy');
      await component.reconnectMicrophone();

      expect(audioSession.recoverMicrophone).toHaveBeenCalledTimes(2);
      expect(component.reconnecting()).toBe(false);
    });

    it('lets the person dismiss the message', () => {
      buttonLabelled('callAudio.dismiss').click();

      expect(audioSession.dismissMicrophoneNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the audio device changes', () => {
    it('names the new microphone', () => {
      deviceNotice.set({ kind: 'audioinput', label: 'USB Headset' });
      fixture.detectChanges();

      expect(text('call-audio-device-notice')).toContain(
        'callAudio.inputChanged|{"device":"USB Headset"}',
      );
    });

    it('names the new speaker', () => {
      deviceNotice.set({ kind: 'audiooutput', label: 'Bluetooth Speaker' });
      fixture.detectChanges();

      expect(text('call-audio-device-notice')).toContain(
        'callAudio.outputChanged|{"device":"Bluetooth Speaker"}',
      );
    });

    it('falls back to the default device wording when the label is unknown', () => {
      deviceNotice.set({ kind: 'audioinput', label: null });
      fixture.detectChanges();
      expect(text('call-audio-device-notice')).toContain('callAudio.inputChangedDefault');

      deviceNotice.set({ kind: 'audiooutput', label: null });
      fixture.detectChanges();
      expect(text('call-audio-device-notice')).toContain('callAudio.outputChangedDefault');
    });

    it('announces the change as a polite status rather than an alert', () => {
      deviceNotice.set({ kind: 'audioinput', label: 'USB Headset' });
      fixture.detectChanges();

      const status = fixture.nativeElement.querySelector('[role="status"]');
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(status.contains(byTestId('call-audio-device-notice'))).toBe(true);
      expect(alert.contains(byTestId('call-audio-device-notice'))).toBe(false);
    });

    it('shows alongside a critical message because it is separate information', () => {
      playbackBlocked.set(true);
      deviceNotice.set({ kind: 'audioinput', label: 'USB Headset' });
      fixture.detectChanges();

      expect(byTestId('call-audio-playback-blocked')).not.toBeNull();
      expect(byTestId('call-audio-device-notice')).not.toBeNull();
    });

    it('lets the person dismiss the message', () => {
      deviceNotice.set({ kind: 'audioinput', label: 'USB Headset' });
      fixture.detectChanges();

      buttonLabelled('callAudio.dismiss').click();

      expect(audioSession.dismissDeviceNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility and layout', () => {
    beforeEach(async () => {
      playbackBlocked.set(false);
      microphoneInterrupted.set(true);
      deviceNotice.set({ kind: 'audioinput', label: 'USB Headset' });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('gives every control a visible text name and a button type', () => {
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );

      expect(buttons.length).toBe(3);
      for (const button of buttons) {
        expect(button.getAttribute('type')).toBe('button');
        expect(button.textContent?.trim().length).toBeGreaterThan(0);
      }
    });

    it('uses touch-sized controls', () => {
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );

      for (const button of buttons) {
        expect(button.className).toContain('min-h-11');
      }
    });

    it('lets message text pick its own direction so device names in any script read correctly', () => {
      const paragraphs: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('p'));

      expect(paragraphs.length).toBe(2);
      for (const paragraph of paragraphs) {
        expect(paragraph.getAttribute('dir')).toBe('auto');
      }
    });

    it('uses logical spacing only so the layout mirrors in right-to-left languages', () => {
      const physical = /(?:^|\s)(?:pl|pr|ml|mr|left|right|border-l|border-r|text-left|text-right)-/;
      const elements: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[class]'));

      for (const element of elements) {
        expect(element.className, element.outerHTML).not.toMatch(physical);
      }
    });
  });
});
