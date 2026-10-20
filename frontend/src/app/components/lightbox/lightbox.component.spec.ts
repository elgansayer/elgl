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
      if (key === 'common.loading') return 'Loading...';
      if (key === 'common.loadError') return 'Could not load image';
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

  function setup(images: string[], initialIndex = 0): void {
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('initialIndex', initialIndex);
    fixture.detectChanges();
  }

  function pointerDown(
    x: number,
    y: number,
    pointerId = 1,
    pointerType = 'touch',
    isPrimary = true,
  ): void {
    component.onPointerDown({
      clientX: x,
      clientY: y,
      pointerId,
      pointerType,
      isPrimary,
    } as PointerEvent);
  }

  function pointerUp(x: number, y: number, pointerId = 1): ReturnType<typeof vi.fn> {
    const preventDefault = vi.fn();
    component.onPointerUp({
      clientX: x,
      clientY: y,
      pointerId,
      preventDefault,
    } as unknown as PointerEvent);
    return preventDefault;
  }

  it('creates and keeps the Spartan dialog open while mounted', () => {
    setup(['a']);

    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('open');
  });

  it('normalises the initial index into the available image range', () => {
    setup(['a', 'b', 'c'], 99);
    expect(component.currentIndex()).toBe(2);

    fixture.componentRef.setInput('initialIndex', -10);
    fixture.detectChanges();
    expect(component.currentIndex()).toBe(0);
  });

  it('defaults invalid initial indexes to the first image', () => {
    setup(['a', 'b'], Number.NaN);
    expect(component.currentIndex()).toBe(0);
  });

  it('moves forward and backward without crossing gallery bounds', () => {
    setup(['a', 'b', 'c'], 0);

    component.prev();
    expect(component.currentIndex()).toBe(0);

    component.next();
    component.next();
    component.next();
    expect(component.currentIndex()).toBe(2);

    component.prev();
    expect(component.currentIndex()).toBe(1);
  });

  it('clamps direct indicator navigation to a valid image', () => {
    setup(['a', 'b', 'c'], 0);

    component.goTo(12);
    expect(component.currentIndex()).toBe(2);

    component.goTo(-4);
    expect(component.currentIndex()).toBe(0);
  });

  it('emits closed only when the Spartan dialog lifecycle closes', () => {
    setup(['a']);
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.onDialogStateChanged('open');
    expect(closed).not.toHaveBeenCalled();

    component.onDialogStateChanged('closed');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('supports arrow, Home and End keyboard navigation', () => {
    setup(['a', 'b', 'c'], 1);

    const end = new KeyboardEvent('keydown', { key: 'End', cancelable: true });
    component.handleKeyDown(end);
    expect(end.defaultPrevented).toBe(true);
    expect(component.currentIndex()).toBe(2);

    const home = new KeyboardEvent('keydown', { key: 'Home', cancelable: true });
    component.handleKeyDown(home);
    expect(home.defaultPrevented).toBe(true);
    expect(component.currentIndex()).toBe(0);

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    component.handleKeyDown(right);
    expect(right.defaultPrevented).toBe(true);
    expect(component.currentIndex()).toBe(1);

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    component.handleKeyDown(left);
    expect(left.defaultPrevented).toBe(true);
    expect(component.currentIndex()).toBe(0);
  });

  it('does not consume unrelated keys or Escape, which belongs to Spartan Dialog', () => {
    setup(['a', 'b'], 0);
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(component.currentIndex()).toBe(0);
    expect(closed).not.toHaveBeenCalled();
  });

  it('swipes left and right with primary touch pointers', () => {
    setup(['a', 'b', 'c'], 1);

    pointerDown(240, 100);
    const leftPreventDefault = pointerUp(120, 104);
    expect(leftPreventDefault).toHaveBeenCalledTimes(1);
    expect(component.currentIndex()).toBe(2);

    pointerDown(120, 100, 2);
    const rightPreventDefault = pointerUp(240, 96, 2);
    expect(rightPreventDefault).toHaveBeenCalledTimes(1);
    expect(component.currentIndex()).toBe(1);
  });

  it('ignores short and predominantly vertical gestures', () => {
    setup(['a', 'b', 'c'], 1);

    pointerDown(200, 100);
    const shortPreventDefault = pointerUp(165, 102);
    expect(shortPreventDefault).not.toHaveBeenCalled();
    expect(component.currentIndex()).toBe(1);

    pointerDown(200, 100, 2);
    const verticalPreventDefault = pointerUp(140, 230, 2);
    expect(verticalPreventDefault).not.toHaveBeenCalled();
    expect(component.currentIndex()).toBe(1);
  });

  it('ignores mouse, secondary and cancelled pointer gestures', () => {
    setup(['a', 'b', 'c'], 1);

    pointerDown(220, 100, 1, 'mouse');
    pointerUp(100, 100, 1);
    expect(component.currentIndex()).toBe(1);

    pointerDown(220, 100, 2, 'touch', false);
    pointerUp(100, 100, 2);
    expect(component.currentIndex()).toBe(1);

    pointerDown(220, 100, 3);
    component.onPointerCancel({ pointerId: 3 } as PointerEvent);
    pointerUp(100, 100, 3);
    expect(component.currentIndex()).toBe(1);
  });

  it('ignores a pointer-up event from a different pointer', () => {
    setup(['a', 'b', 'c'], 1);

    pointerDown(220, 100, 10);
    const preventDefault = pointerUp(100, 100, 11);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(component.currentIndex()).toBe(1);
  });

  it('tracks image load failures without logging or blocking gallery navigation', () => {
    setup(['a', 'b'], 0);

    component.onImageError('a');
    expect(component.isImageFailed('a')).toBe(true);
    expect(component.isImageLoaded('a')).toBe(false);

    component.next();
    expect(component.currentIndex()).toBe(1);

    component.onImageLoad('a');
    expect(component.isImageFailed('a')).toBe(false);
    expect(component.isImageLoaded('a')).toBe(true);
  });

  it('records successful image loads independently', () => {
    setup(['a', 'b'], 0);

    component.onImageLoad('a');

    expect(component.isImageLoaded('a')).toBe(true);
    expect(component.isImageLoaded('b')).toBe(false);
    expect(component.isImageFailed('a')).toBe(false);
  });

  it('stops propagation for explicit arrow and indicator controls', () => {
    setup(['a', 'b'], 0);
    const nextEvent = { stopPropagation: vi.fn() } as unknown as Event;
    const indicatorEvent = { stopPropagation: vi.fn() } as unknown as Event;

    component.next(nextEvent);
    component.goTo(0, indicatorEvent);

    expect(nextEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(indicatorEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
