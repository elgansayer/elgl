/**
 * @vitest-environment jsdom
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslatePipe } from '../../services/translate.pipe';
import { DoodlePadComponent } from './doodle-pad.component';

@Pipe({ standalone: true, name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return `t:${key}`;
  }
}

describe('DoodlePadComponent', () => {
  let fixture: ComponentFixture<DoodlePadComponent>;
  let component: DoodlePadComponent;
  let canvasEl: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(async () => {
    mockCtx = {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
      return contextId === '2d' ? mockCtx : null;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,mock',
    );

    await TestBed.configureTestingModule({
      imports: [DoodlePadComponent],
    })
      .overrideComponent(DoodlePadComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DoodlePadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    canvasEl = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 310,
      bottom: 220,
      width: 300,
      height: 200,
      toJSON: () => ({}),
    });
    Object.defineProperty(canvasEl, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(canvasEl, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => true),
    });
    Object.defineProperty(canvasEl, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function pointerEvent(
    type: string,
    x: number,
    y: number,
    options: {
      pointerId?: number;
      pointerType?: string;
      button?: number;
      isPrimary?: boolean;
    } = {},
  ): PointerEvent {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      button: options.button ?? 0,
      bubbles: true,
      cancelable: true,
    }) as unknown as PointerEvent;

    Object.defineProperties(event, {
      pointerId: { value: options.pointerId ?? 1 },
      pointerType: { value: options.pointerType ?? 'mouse' },
      isPrimary: { value: options.isPrimary ?? true },
    });
    return event;
  }

  it('initialises the drawing surface at the canonical raster size', () => {
    expect(component).toBeTruthy();
    expect(canvasEl.width).toBe(600);
    expect(canvasEl.height).toBe(400);
    expect(mockCtx.fillStyle).toBe('#ffffff');
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 600, 400);
    expect(mockCtx.lineCap).toBe('round');
    expect(mockCtx.lineJoin).toBe('round');
  });

  it('exposes an accessible drawing surface and translated close control', () => {
    expect(canvasEl.getAttribute('role')).toBe('img');
    expect(canvasEl.getAttribute('aria-label')).toBe('t:doodle.title');
    expect(canvasEl.getAttribute('aria-describedby')).toBe('doodle-pad-instructions');
    expect(canvasEl.classList.contains('touch-none')).toBe(true);

    const close = fixture.nativeElement.querySelector(
      'button[aria-label="t:doodle.cancelBtn"]',
    ) as HTMLButtonElement;
    expect(close).toBeTruthy();
    expect(close.type).toBe('button');
  });

  it('uses Spartan radio groups for mutually exclusive colour and brush controls', () => {
    const colorGroup = fixture.nativeElement.querySelector(
      'hlm-radio-group[name="doodle-color"]',
    );
    const brushGroup = fixture.nativeElement.querySelector(
      'hlm-radio-group[name="doodle-brush-width"]',
    );

    expect(colorGroup).toBeTruthy();
    expect(brushGroup).toBeTruthy();
    expect(colorGroup.querySelectorAll('hlm-radio').length).toBe(6);
    expect(brushGroup.querySelectorAll('hlm-radio').length).toBe(4);
  });

  it('keeps selection controls at the 44px touch baseline and wrap-safe at high zoom', () => {
    const colorLabels = Array.from(
      fixture.nativeElement.querySelectorAll('hlm-radio-group[name="doodle-color"] label'),
    ) as HTMLLabelElement[];
    const brushLabels = Array.from(
      fixture.nativeElement.querySelectorAll('hlm-radio-group[name="doodle-brush-width"] label'),
    ) as HTMLLabelElement[];
    const selectionToolbar = fixture.nativeElement.querySelector('fieldset')?.parentElement;

    expect(colorLabels).toHaveLength(6);
    expect(brushLabels).toHaveLength(4);
    for (const label of colorLabels) {
      expect(label.classList.contains('size-11')).toBe(true);
      expect(label.classList.contains('size-10')).toBe(false);
    }
    for (const label of brushLabels) {
      expect(label.classList.contains('min-h-11')).toBe(true);
      expect(label.classList.contains('min-w-11')).toBe(true);
      expect(label.classList.contains('min-h-10')).toBe(false);
    }
    expect(selectionToolbar?.classList.contains('grid')).toBe(true);
  });

  it('avoids physical direction utilities in RTL-compatible layout', () => {
    const html = fixture.nativeElement.innerHTML as string;

    expect(html).not.toMatch(/\b(?:ms|me|ps|pe)?-?left-/);
    expect(html).not.toMatch(/\b(?:ms|me|ps|pe)?-?right-/);
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr)-/);
  });

  it('uses Relay semantic surfaces and mobile-first wrapping for product chrome', () => {
    const canvasFrame = canvasEl.parentElement as HTMLElement;
    expect(canvasFrame.classList.contains('bg-surface-300')).toBe(true);
    expect(canvasFrame.classList.contains('border-surface-100')).toBe(true);
    expect(canvasEl.classList.contains('bg-surface-50')).toBe(true);

    const toolbar = fixture.nativeElement.querySelector(
      'hlm-radio-group[name="doodle-color"]',
    ).parentElement.parentElement as HTMLElement;
    expect(toolbar.classList.contains('grid')).toBe(true);
    expect(toolbar.classList.contains('sm:grid-cols-2')).toBe(true);

    const footer = Array.from(fixture.nativeElement.querySelectorAll('div')).find((element) =>
      (element as HTMLElement).classList.contains('sm:flex-row'),
    ) as HTMLElement | undefined;
    expect(footer).toBeTruthy();
    expect(footer?.classList.contains('flex-col')).toBe(true);
  });

  it('accepts only configured colour and brush values', () => {
    component.setColor('#ef4444');
    component.setBrushWidth(8);
    expect(component.currentColor).toBe('#ef4444');
    expect(component.brushWidth).toBe(8);

    component.setColor('#ffffff');
    component.setBrushWidth(999);
    component.setBrushWidthFromValue('not-a-number');
    expect(component.currentColor).toBe('#ef4444');
    expect(component.brushWidth).toBe(8);
  });

  it('scales pointer coordinates from responsive CSS size to the backing raster', () => {
    component.startDrawing(pointerEvent('pointerdown', 100, 100));

    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.moveTo).toHaveBeenCalledWith(180, 160);
    expect(canvasEl.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('draws with the selected colour and width for the active pointer', () => {
    component.setColor('#3b82f6');
    component.setBrushWidth(8);
    component.startDrawing(pointerEvent('pointerdown', 50, 50));
    component.draw(pointerEvent('pointermove', 100, 100));

    expect(mockCtx.strokeStyle).toBe('#3b82f6');
    expect(mockCtx.lineWidth).toBe(8);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(180, 160);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(1);
  });

  it('ignores movement from a pointer that did not start the stroke', () => {
    component.startDrawing(pointerEvent('pointerdown', 50, 50, { pointerId: 7 }));
    component.draw(pointerEvent('pointermove', 100, 100, { pointerId: 8 }));

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('ignores secondary mouse buttons and non-primary pointers', () => {
    component.startDrawing(pointerEvent('pointerdown', 50, 50, { button: 2 }));
    component.startDrawing(
      pointerEvent('pointerdown', 50, 50, { pointerId: 2, isPrimary: false }),
    );

    expect(mockCtx.beginPath).not.toHaveBeenCalled();
    expect(canvasEl.setPointerCapture).not.toHaveBeenCalled();
  });

  it('ends and releases a stroke on pointer cancellation', () => {
    component.startDrawing(pointerEvent('pointerdown', 50, 50, { pointerId: 4 }));
    component.stopDrawing(pointerEvent('pointercancel', 50, 50, { pointerId: 4 }));
    component.draw(pointerEvent('pointermove', 100, 100, { pointerId: 4 }));

    expect(mockCtx.closePath).toHaveBeenCalledTimes(1);
    expect(canvasEl.releasePointerCapture).toHaveBeenCalledWith(4);
    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('wires pointer events from the canvas template', () => {
    const startSpy = vi.spyOn(component, 'startDrawing');
    const drawSpy = vi.spyOn(component, 'draw');
    const stopSpy = vi.spyOn(component, 'stopDrawing');

    canvasEl.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    canvasEl.dispatchEvent(pointerEvent('pointermove', 60, 60));
    canvasEl.dispatchEvent(pointerEvent('pointerup', 60, 60));

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(drawSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('clears the raster and terminates any active stroke', () => {
    component.startDrawing(pointerEvent('pointerdown', 50, 50));
    vi.mocked(mockCtx.fillRect).mockClear();

    component.clearCanvas();

    expect(mockCtx.closePath).toHaveBeenCalled();
    expect(mockCtx.fillStyle).toBe('#ffffff');
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 600, 400);
  });

  it('emits one PNG data URL when the doodle is saved', () => {
    const listener = vi.fn();
    component.doodleSaved.subscribe(listener);

    component.save();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('data:image/png;base64,mock');
  });

  it('does not emit an unexpected non-PNG serialization result', () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue('data:text/plain;base64,bad');
    const listener = vi.fn();
    component.doodleSaved.subscribe(listener);

    component.save();

    expect(listener).not.toHaveBeenCalled();
  });

  it('terminates drawing and emits cancellation exactly once', () => {
    const listener = vi.fn();
    component.cancelled.subscribe(listener);
    component.startDrawing(pointerEvent('pointerdown', 50, 50));

    component.cancel();

    expect(mockCtx.closePath).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('send state owned by the host', () => {
    const primaryButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('app-button-primary button') as HTMLButtonElement;
    const secondaryButtons = (): HTMLButtonElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('app-button-secondary button'));

    it('shows no alert and announces nothing while idle', () => {
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
      expect(status.textContent?.trim()).toBe('');
      expect(primaryButton().disabled).toBe(false);
      expect(primaryButton().textContent?.trim()).toBe('t:doodle.sendBtn');
    });

    it('keeps one live region mounted and changes its text, so the announcement is reliable', () => {
      const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;

      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="status"]')).toBe(status);
      expect(status.textContent?.trim()).toBe('t:doodle.sendingBtn');

      fixture.componentRef.setInput('busy', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="status"]')).toBe(status);
      expect(status.textContent?.trim()).toBe('');
    });

    it('announces a send failure through the translation key supplied by the host', () => {
      fixture.componentRef.setInput('errorKey', 'doodle.sendFailed');
      fixture.detectChanges();

      const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent?.trim()).toBe('t:doodle.sendFailed');
      // Failure must not freeze the editor: the learner can retry or keep drawing.
      expect(primaryButton().disabled).toBe(false);
    });

    it('disables send and clear and relabels send while a doodle is being sent', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();

      expect(primaryButton().disabled).toBe(true);
      expect(primaryButton().textContent?.trim()).toBe('t:doodle.sendingBtn');
      const clear = secondaryButtons().find((button) =>
        button.getAttribute('aria-label')?.includes('doodle.clearBtn'),
      );
      expect(clear?.disabled).toBe(true);
      const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
      expect(status.textContent?.trim()).toBe('t:doodle.sendingBtn');
    });

    it('keeps cancel available while sending so a stalled request cannot trap the learner', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();

      const cancel = secondaryButtons().find((button) =>
        button.getAttribute('aria-label')?.includes('doodle.cancelBtn'),
      );
      expect(cancel?.disabled).toBe(false);
      const listener = vi.fn();
      component.cancelled.subscribe(listener);

      cancel?.click();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not emit a second doodle while one is being sent', () => {
      const listener = vi.fn();
      component.doodleSaved.subscribe(listener);
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();

      component.save();
      primaryButton().click();

      expect(listener).not.toHaveBeenCalled();
    });

    it('freezes the raster while sending so the sent image cannot change underneath it', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      vi.mocked(mockCtx.fillRect).mockClear();

      component.startDrawing(pointerEvent('pointerdown', 50, 50));
      component.clearCanvas();

      expect(mockCtx.beginPath).not.toHaveBeenCalled();
      expect(canvasEl.setPointerCapture).not.toHaveBeenCalled();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('resumes drawing and sending once the host reports it is idle again', () => {
      const listener = vi.fn();
      component.doodleSaved.subscribe(listener);
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('busy', false);
      fixture.detectChanges();

      component.startDrawing(pointerEvent('pointerdown', 50, 50));
      component.save();

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
