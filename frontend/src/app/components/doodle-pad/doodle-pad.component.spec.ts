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
    expect(mockCtx.fillStyle).toBe('#1e1e1e');
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
    expect(selectionToolbar?.classList.contains('flex-wrap')).toBe(true);
  });

  it('uses logical direction classes instead of physical left or right utilities', () => {
    const html = fixture.nativeElement.innerHTML as string;

    expect(html).toContain('me-2');
    expect(html).not.toMatch(/\b(?:ms|me|ps|pe)?-?left-/);
    expect(html).not.toMatch(/\b(?:ms|me|ps|pe)?-?right-/);
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr)-/);
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
    expect(mockCtx.fillStyle).toBe('#1e1e1e');
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
});
