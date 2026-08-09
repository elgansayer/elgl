import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GiftAnimationComponent } from './gift-animation.component';
import { GiftPayload } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('GiftAnimationComponent', () => {
  let component: GiftAnimationComponent;
  let fixture: ComponentFixture<GiftAnimationComponent>;

  const mockGiftPayload: GiftPayload = {
    gift_id: 'gift_rose',
    gift_name: 'Rose',
    gift_icon: '🌹',
    coin_value: 10,
    animation_type: 'float',
    sender_name: 'Alice',
    receiver_name: 'Bob',
  };

  const mockTranslatePipe = {
    transform: (key: string, params?: Record<string, unknown>) =>
      `[${key}]` + (params ? ` ${JSON.stringify(params)}` : ''),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GiftAnimationComponent],
      providers: [
        { provide: TranslatePipe, useValue: mockTranslatePipe },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GiftAnimationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('giftPayload', mockGiftPayload);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render gift icon when gift payload is provided', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('🌹');
  });

  it('should display gift name', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Rose');
  });

  it('should display coin value', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('10');
  });

  it('should generate 8 particles', () => {
    expect(component.particles().length).toBe(8);
  });

  it('should have correct ARIA label', () => {
    const el = fixture.nativeElement as HTMLElement;
    const bubble = el.querySelector('[role="status"]');
    expect(bubble).toBeTruthy();
  });
});