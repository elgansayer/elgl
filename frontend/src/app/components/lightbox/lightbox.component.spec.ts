import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LightboxComponent } from './lightbox.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

describe('LightboxComponent', () => {
  let component: LightboxComponent;
  let fixture: ComponentFixture<LightboxComponent>;

  const mockI18nService = {
    translate: vi.fn().mockImplementation((key: string, params?: Record<string, unknown>) => {
      if (key === 'lightbox.close') return 'Close lightbox';
      if (key === 'lightbox.prev') return 'Previous image';
      if (key === 'lightbox.next') return 'Next image';
      if (key === 'lightbox.imageAlt')
        return `Image ${params?.['current']} of ${params?.['total']}`;
      if (key === 'lightbox.indicator') return `Go to image ${params?.['current']}`;
      return key;
    }),
    translations: signal({}),
    loadTranslations: vi.fn(),
    locale: signal('en'),
    direction: signal('ltr'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightboxComponent, TranslatePipe],
      providers: [{ provide: I18nService, useValue: mockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LightboxComponent);
    component = fixture.componentInstance;
  });

  function setup(images: string[], initialIndex = 0) {
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('initialIndex', initialIndex);
    fixture.detectChanges();
  }

  it('should create the component', () => {
    setup(['a']);
    expect(component).toBeTruthy();
  });

  it('keeps the Spartan dialog open while the lightbox is mounted', () => {
    setup(['a']);
    expect(component.dialogState()).toBe('open');
  });

  it('should converge currentIndex to initialIndex via linked signal', () => {
    setup(['a', 'b', 'c'], 2);
    expect(component.currentIndex()).toBe(2);
  });

  it('should default currentIndex to 0 when initialIndex is not provided', () => {
    setup(['a', 'b']);
    expect(component.currentIndex()).toBe(0);
  });

  it('should increase currentIndex on next', () => {
    setup(['a', 'b', 'c'], 0);
    component.next();
    expect(component.currentIndex()).toBe(1);
  });

  it('should not exceed last index on next', () => {
    setup(['a', 'b'], 1);
    component.next();
    expect(component.currentIndex()).toBe(1);
  });

  it('should decrease currentIndex on prev', () => {
    setup(['a', 'b', 'c'], 2);
    component.prev();
    expect(component.currentIndex()).toBe(1);
  });

  it('should not go below zero on prev', () => {
    setup(['a', 'b'], 0);
    component.prev();
    expect(component.currentIndex()).toBe(0);
  });

  it('should goTo a specific index', () => {
    setup(['a', 'b', 'c'], 0);
    component.goTo(2);
    expect(component.currentIndex()).toBe(2);
  });

  it('emits closed when the Spartan dialog lifecycle closes', () => {
    setup(['a']);
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    component.onDialogStateChanged('closed');
    expect(closed).toBe(true);
  });

  it('does not emit closed while the Spartan dialog remains open', () => {
    setup(['a']);
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    component.onDialogStateChanged('open');
    expect(closed).toBe(false);
  });

  it('should increase currentIndex on ArrowRight', () => {
    setup(['a', 'b', 'c'], 0);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.currentIndex()).toBe(1);
  });

  it('should decrease currentIndex on ArrowLeft', () => {
    setup(['a', 'b', 'c'], 1);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.currentIndex()).toBe(0);
  });

  it('leaves Escape dismissal to the Spartan dialog lifecycle', () => {
    setup(['a', 'b'], 0);
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.currentIndex()).toBe(0);
    expect(closed).toBe(false);
  });

  it('should handle swipe left to go next', () => {
    setup(['a', 'b', 'c'], 0);

    const touchStartEvent = { changedTouches: [{ screenX: 200 }] } as unknown as TouchEvent;
    const touchEndEvent = { changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchEnd(touchEndEvent);
    expect(component.currentIndex()).toBe(1);
  });

  it('should handle swipe right to go prev', () => {
    setup(['a', 'b', 'c'], 1);

    const touchStartEvent = { changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent;
    const touchEndEvent = { changedTouches: [{ screenX: 200 }] } as unknown as TouchEvent;
    component.onTouchStart(touchStartEvent);
    component.onTouchEnd(touchEndEvent);
    expect(component.currentIndex()).toBe(0);
  });

  it('should stop propagation on next arrow click', () => {
    setup(['a', 'b'], 0);

    let propagated = false;
    const event = new Event('click', { bubbles: true });
    const originalStop = event.stopPropagation.bind(event);
    event.stopPropagation = () => {
      propagated = true;
      originalStop();
    };

    component.next(event);
    expect(propagated).toBe(true);
    expect(component.currentIndex()).toBe(1);
  });

  it('should stop propagation on prev arrow click', () => {
    setup(['a', 'b'], 0);

    let propagated = false;
    const event = new Event('click', { bubbles: true });
    const originalStop = event.stopPropagation.bind(event);
    event.stopPropagation = () => {
      propagated = true;
      originalStop();
    };

    component.prev(event);
    expect(propagated).toBe(true);
    expect(component.currentIndex()).toBe(0);
  });

  it('should emit closed when close button is clicked', () => {
    setup(['a']);
    let closed = false;
    component.closed.subscribe(() => (closed = true));
    component.closed.emit();
    expect(closed).toBe(true);
  });

  it('should ignore non-navigation keys on keydown', () => {
    setup(['a', 'b'], 0);

    let closed = false;
    component.closed.subscribe(() => (closed = true));

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(component.currentIndex()).toBe(0);
    expect(closed).toBe(false);

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

    expect(component.currentIndex()).toBe(0);
    expect(closed).toBe(false);
  });

  it('should not change index on short horizontal swipe', () => {
    setup(['a', 'b', 'c'], 0);

    component.onTouchStart({
      changedTouches: [{ screenX: 200 }],
    } as unknown as TouchEvent);
    component.onTouchEnd({
      changedTouches: [{ screenX: 196 }],
    } as unknown as TouchEvent);

    expect(component.currentIndex()).toBe(0);
  });

  it('should ignore vertical swipe', () => {
    setup(['a', 'b', 'c'], 0);

    component.onTouchStart({
      changedTouches: [{ screenX: 100, screenY: 100 }],
    } as unknown as TouchEvent);
    component.onTouchEnd({
      changedTouches: [{ screenX: 100, screenY: 300 }],
    } as unknown as TouchEvent);

    expect(component.currentIndex()).toBe(0);
  });

  it('should stop propagation on goTo click', () => {
    setup(['a', 'b'], 0);

    let propagated = false;
    const event = new Event('click', { bubbles: true });
    const originalStop = event.stopPropagation.bind(event);
    event.stopPropagation = () => {
      propagated = true;
      originalStop();
    };

    component.goTo(1, event);
    expect(propagated).toBe(true);
    expect(component.currentIndex()).toBe(1);
  });

  it('should not change index when swipe threshold is exactly 50', () => {
    setup(['a', 'b', 'c'], 0);

    component.onTouchStart({
      changedTouches: [{ screenX: 150 }],
    } as unknown as TouchEvent);
    component.onTouchEnd({
      changedTouches: [{ screenX: 100 }],
    } as unknown as TouchEvent);

    expect(component.currentIndex()).toBe(0);
  });
});
