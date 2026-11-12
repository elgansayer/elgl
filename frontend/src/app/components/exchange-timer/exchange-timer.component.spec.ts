import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ExchangeTimerComponent } from './exchange-timer.component';
import { ExchangeTimerService } from '../../services/exchange-timer.service';
import { I18nService } from '../../services/i18n.service';

describe('ExchangeTimerComponent', () => {
  let fixture: ComponentFixture<ExchangeTimerComponent>;
  let timer: {
    isActive: WritableSignal<boolean>;
    isMyTurn: WritableSignal<boolean>;
    currentSpeakerLanguage: WritableSignal<string | null>;
    remainingSeconds: WritableSignal<number>;
    advanceTurn: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    timer = {
      isActive: signal(true),
      isMyTurn: signal(true),
      currentSpeakerLanguage: signal<string | null>('en'),
      remainingSeconds: signal(240),
      advanceTurn: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [ExchangeTimerComponent],
      providers: [
        { provide: ExchangeTimerService, useValue: timer },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExchangeTimerComponent);
    fixture.detectChanges();
  }

  it('renders nothing while the exchange timer is inactive', async () => {
    await createComponent();
    timer.isActive.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('shows the current speaker language and a formatted countdown', async () => {
    await createComponent();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('video_call.exchange_your_turn');
    expect(text).toContain('en');
    expect(text).toContain('04:00');
  });

  it('lets the current speaker end the turn early', async () => {
    await createComponent();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(timer.advanceTurn).toHaveBeenCalledTimes(1);
  });

  it('locks the turn and hides the end-turn control for the listening partner', async () => {
    await createComponent();
    timer.isMyTurn.set(false);
    timer.currentSpeakerLanguage.set('es');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('video_call.exchange_partner_turn');
    expect(text).toContain('video_call.exchange_muted_until_turn');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
