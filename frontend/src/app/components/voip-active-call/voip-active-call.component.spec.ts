import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lucideMic,
  lucideMicOff,
  lucidePhoneOff,
  lucideVolume2,
  lucideVolumeX,
} from '@ng-icons/lucide';
import { I18nService } from '../../services/i18n.service';
import { VoipActiveCallComponent } from './voip-active-call.component';

/** Markup inside the root <svg> of a registered Lucide glyph, as ng-icon renders it. */
function glyphMarkup(icon: string): string {
  const template = document.createElement('template');
  template.innerHTML = icon;
  return template.content.firstElementChild?.innerHTML ?? '';
}

describe('VoipActiveCallComponent', () => {
  let fixture: ComponentFixture<VoipActiveCallComponent>;
  let component: VoipActiveCallComponent;
  let root: HTMLElement;

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const controls = (): {
    mute: HTMLButtonElement;
    speaker: HTMLButtonElement;
    end: HTMLButtonElement;
  } => {
    const [mute, speaker, end] = Array.from(root.querySelectorAll('button'));
    return { mute, speaker, end };
  };

  const renderedGlyph = (button: HTMLButtonElement): string | undefined =>
    button.querySelector('ng-icon svg')?.innerHTML;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoipActiveCallComponent],
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipActiveCallComponent);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    fixture.componentRef.setInput('avatarUrl', 'https://cdn.example.test/maria.png');
    fixture.componentRef.setInput('callerName', 'María');
    fixture.componentRef.setInput('callDurationSeconds', 767);
    await settle();
  });

  it('shows the caller and a minutes:seconds duration', () => {
    const avatar = root.querySelector('img');

    expect(avatar?.getAttribute('alt')).toBe('María');
    expect(avatar?.getAttribute('src')).toBe('https://cdn.example.test/maria.png');
    expect(root.textContent).toContain('María');
    expect(root.textContent).toContain('12:47');
  });

  it('prefixes hours once a call runs longer than an hour', async () => {
    fixture.componentRef.setInput('callDurationSeconds', 3725);
    await settle();

    expect(root.textContent).toContain('01:02:05');
  });

  describe('control icons', () => {
    it('renders vector glyphs and never icon-font ligature text', () => {
      const { mute, speaker, end } = controls();

      for (const button of [mute, speaker, end]) {
        expect(button.querySelector('ng-icon svg')).not.toBeNull();
        expect(button.textContent).not.toMatch(/\b(?:mic|mic_off|volume_up|volume_off|call_end)\b/);
      }
      expect(root.querySelector('.material-icons')).toBeNull();
    });

    it('shows the microphone while live and the crossed microphone while muted', async () => {
      const { mute } = controls();
      const muteChange = vi.fn();
      component.muteChange.subscribe(muteChange);

      expect(renderedGlyph(mute)).toBe(glyphMarkup(lucideMic));

      mute.click();
      await settle();

      expect(renderedGlyph(mute)).toBe(glyphMarkup(lucideMicOff));
      expect(mute.textContent).toContain('call.unmute');
      expect(muteChange).toHaveBeenLastCalledWith(true);

      mute.click();
      await settle();

      expect(renderedGlyph(mute)).toBe(glyphMarkup(lucideMic));
      expect(mute.textContent).toContain('call.mute');
      expect(muteChange).toHaveBeenLastCalledWith(false);
    });

    it('shows the silent speaker until the loudspeaker is switched on', async () => {
      const { speaker } = controls();
      const speakerChange = vi.fn();
      component.speakerChange.subscribe(speakerChange);

      expect(renderedGlyph(speaker)).toBe(glyphMarkup(lucideVolumeX));

      speaker.click();
      await settle();

      expect(renderedGlyph(speaker)).toBe(glyphMarkup(lucideVolume2));
      expect(speakerChange).toHaveBeenLastCalledWith(true);

      speaker.click();
      await settle();

      expect(renderedGlyph(speaker)).toBe(glyphMarkup(lucideVolumeX));
      expect(speakerChange).toHaveBeenLastCalledWith(false);
    });

    it('ends the call from the hang-up control', () => {
      const { end } = controls();
      const endCall = vi.fn();
      component.endCall.subscribe(endCall);

      expect(renderedGlyph(end)).toBe(glyphMarkup(lucidePhoneOff));

      end.click();

      expect(endCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility and sizing', () => {
    it('hides the decorative glyphs and keeps translated accessible names on the buttons', () => {
      const { mute, speaker, end } = controls();
      const icons = Array.from(root.querySelectorAll('ng-icon'));

      expect(icons).toHaveLength(3);
      for (const icon of icons) {
        expect(icon.getAttribute('aria-hidden')).toBe('true');
      }
      expect(mute.getAttribute('aria-label')).toBe('call.mute');
      expect(speaker.getAttribute('aria-label')).toBe('call.speaker');
      expect(end.getAttribute('aria-label')).toBe('call.hang_up');
    });

    it('sizes every glyph at the canonical 20px then 24px step', () => {
      const icons = Array.from(root.querySelectorAll('ng-icon'));

      expect(icons).toHaveLength(3);
      for (const icon of icons) {
        expect(icon.classList.contains('text-xl')).toBe(true);
        expect(icon.classList.contains('sm:text-2xl')).toBe(true);
      }
    });
  });
});
