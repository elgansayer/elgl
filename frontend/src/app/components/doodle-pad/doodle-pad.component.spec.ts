/**
 * @vitest-environment jsdom
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, Component } from '@angular/core';
import { DoodlePadComponent } from './doodle-pad.component';

@Pipe({ standalone: true, name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return 't:' + key;
  }
}

@Component({
  standalone: true,
  imports: [DoodlePadComponent, MockTranslatePipe],
  template: `
    <app-doodle-pad
      (doodleSaved)="onDoodleSaved($event)"
      (cancelled)="onCancelled()"
    ></app-doodle-pad>
  `,
})
class TestHostComponent {
  saved: string | null = null;
  wasCancelled = false;

  onDoodleSaved(data: string): void {
    this.saved = data;
  }
  onCancelled(): void {
    this.wasCancelled = true;
  }
}

describe('DoodlePadComponent', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
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
      clearRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (
        this: HTMLCanvasElement,
        ctxType: string,
      ): RenderingContext | null {
        if (ctxType === '2d') return mockCtx;
        return origGetContext.call(this, ctxType);
      },
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,mock',
    );

    // Resolve external template/style resources before TestBed compilation
    const { ɵresolveComponentResources } = await import('@angular/core');
    await ɵresolveComponentResources(DoodlePadComponent);

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, DoodlePadComponent, MockTranslatePipe],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    host = hostFixture.componentInstance;
    hostFixture.detectChanges();

    const child = hostFixture.debugElement.children[0];
    component = child.componentInstance as DoodlePadComponent;

    canvasEl = hostFixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    canvasEl.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 400,
      width: 600, height: 400, x: 0, y: 0, toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- Basic existence checks --

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders a canvas', () => {
    expect(canvasEl.tagName).toBe('CANVAS');
  });

  it('has default colour #000000 and brush width 4', () => {
    expect(component.currentColor).toBe('#000000');
    expect(component.brushWidth).toBe(4);
  });

  it('has six colours in the palette', () => {
    expect(component.colors.length).toBe(6);
  });

  it('updates colour via setColor', () => {
    component.setColor('#ef4444');
    expect(component.currentColor).toBe('#ef4444');
  });

  it('updates brush width via setBrushWidth', () => {
    component.setBrushWidth(8);
    expect(component.brushWidth).toBe(8);
  });

  it('shows the clear, cancel, and send action buttons in the template', () => {
    const buttons = hostFixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map(
      (b: unknown) => (b as HTMLElement).textContent?.trim() ?? '',
    );
    expect(labels.some((l: string) => l.includes('doodle.clearBtn'))).toBe(true);
    expect(labels.some((l: string) => l.includes('doodle.cancelBtn'))).toBe(true);
    expect(labels.some((l: string) => l.includes('doodle.sendBtn'))).toBe(true);
  });

  // -- Canvas operations --

  it('clears the canvas with dark fill', () => {
    component.clearCanvas();
    expect(mockCtx.fillStyle).toBe('#1e1e1e');
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 600, 400);
  });

  it('emits doodleSaved with a base64 data URL on save', () => {
    component.save();
    expect(host.saved).toBe('data:image/png;base64,mock');
  });

  it('emits cancelled on cancel', () => {
    component.cancel();
    expect(host.wasCancelled).toBe(true);
  });

  // -- Drawing via mouse events --

  describe('mouse drawing', () => {
    function mkEv(type: string, x: number, y: number): MouseEvent {
      return new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    }

    it('begins a path on mousedown and moves to the correct point', () => {
      component.startDrawing(mkEv('mousedown', 100, 100));
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
    });

    it('strokes on mousemove while drawing', () => {
      component.startDrawing(mkEv('mousedown', 50, 50));
      component.draw(mkEv('mousemove', 100, 100));
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('does not stroke on mousemove when not drawing', () => {
      vi.clearAllMocks();
      component.draw(mkEv('mousemove', 100, 100));
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('uses the current colour and brush width while drawing', () => {
      component.setColor('#3b82f6');
      component.setBrushWidth(8);
      component.startDrawing(mkEv('mousedown', 50, 50));
      component.draw(mkEv('mousemove', 100, 100));
      expect(mockCtx.strokeStyle).toBe('#3b82f6');
      expect(mockCtx.lineWidth).toBe(8);
    });
  });

  // -- Drawing via touch events --

  describe('touch drawing', () => {
    function mkTouch(type: string, x: number, y: number): TouchEvent {
      const t = new Touch({
        identifier: 0, target: canvasEl,
        clientX: x, clientY: y,
        pageX: x, pageY: y,
        screenX: x, screenY: y,
        radiusX: 1, radiusY: 1,
        rotationAngle: 0, force: 1,
      });
      return new TouchEvent(type, {
        touches: [t], changedTouches: [t], bubbles: true,
      });
    }

    it('begins a path on touchstart', () => {
      component.startDrawing(mkTouch('touchstart', 100, 100));
      expect(mockCtx.beginPath).toHaveBeenCalled();
    });

    it('strokes on touchmove while drawing', () => {
      component.startDrawing(mkTouch('touchstart', 50, 50));
      component.draw(mkTouch('touchmove', 150, 150));
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('skips a touchmove event with zero active touches', () => {
      vi.clearAllMocks();
      component.draw(
        new TouchEvent('touchmove', { touches: [], bubbles: true }),
      );
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });
  });

  // -- DOM event binding smoke tests --

  describe('template canvas listeners', () => {
    it('triggers startDrawing on canvas mousedown', () => {
      const spy = vi.spyOn(component, 'startDrawing');
      canvasEl.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }),
      );
      expect(spy).toHaveBeenCalled();
    });

    it('triggers draw on canvas mousemove', () => {
      const spy = vi.spyOn(component, 'draw');
      canvasEl.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }),
      );
      expect(spy).toHaveBeenCalled();
    });

    it('triggers stopDrawing on canvas mouseup', () => {
      const spy = vi.spyOn(component, 'stopDrawing');
      canvasEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(spy).toHaveBeenCalled();
    });

    it('triggers stopDrawing on canvas mouseleave', () => {
      const spy = vi.spyOn(component, 'stopDrawing');
      canvasEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      expect(spy).toHaveBeenCalled();
    });
  });
});
