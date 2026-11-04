import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { GiftAnimationComponent } from './gift-animation.component';

describe('GiftAnimationComponent', () => {
  let fixture: ComponentFixture<GiftAnimationComponent>;

  const giftPayload = {
    gift_id: 'gift_rose',
    gift_name: 'Rose',
    gift_icon: '🌹',
    coin_value: 10,
    animation_type: 'float',
    sender_name: 'Alice',
    receiver_name: 'Bob',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GiftAnimationComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              if (key === 'gift.broadcastDesc') {
                return `${params?.['sender']} sent ${params?.['receiver']} ${params?.['giftName']} for ${params?.['cost']} coins`;
              }
              if (key === 'gift.coinValue') return `${params?.['cost']} coins`;
              if (key === 'gift.unavailable') return 'Gift details unavailable';
              if (key === 'gift.someone') return 'Someone';
              if (key === 'gift.you') return 'you';
              return key;
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(GiftAnimationComponent);
  });

  it('renders a validated gift payload with an accessible status', async () => {
    fixture.componentRef.setInput('giftPayload', giftPayload);
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="status"]',
    );
    expect(status?.textContent).toContain('🌹');
    expect(status?.textContent).toContain('Rose');
    expect(status?.textContent).toContain('10 coins');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-label')).toBe('Alice sent Bob Rose for 10 coins');
  });

  it('generates stable decorative particles from the gift identity', async () => {
    fixture.componentRef.setInput('giftPayload', giftPayload);
    await fixture.whenStable();

    const firstParticles = fixture.componentInstance.particles();
    fixture.componentRef.setInput('giftPayload', { ...giftPayload });
    await fixture.whenStable();

    expect(firstParticles).toHaveLength(8);
    expect(fixture.componentInstance.particles()).toEqual(firstParticles);
    expect(fixture.nativeElement.querySelectorAll('.gift-particle')).toHaveLength(8);
  });

  it('uses translated participant fallbacks when names are absent', async () => {
    fixture.componentRef.setInput('giftPayload', {
      ...giftPayload,
      sender_name: null,
      receiver_name: null,
    });
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="status"]',
    );
    expect(status?.getAttribute('aria-label')).toBe('Someone sent you Rose for 10 coins');
  });

  it('renders a localised unavailable state for a missing or malformed payload', async () => {
    fixture.componentRef.setInput('giftPayload', {
      gift_id: 'gift_rose',
      gift_name: '',
      gift_icon: '🌹',
      coin_value: -1,
    });
    await fixture.whenStable();

    expect(fixture.componentInstance.gift()).toBeNull();
    expect(fixture.componentInstance.particles()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Gift details unavailable');
    expect(fixture.nativeElement.querySelector('.gift-particle')).toBeNull();
  });
});
