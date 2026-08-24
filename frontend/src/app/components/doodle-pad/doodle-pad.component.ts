import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import {
  Component,
  ElementRef,
  afterNextRender,
  output,
  viewChild,
} from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const CANVAS_BACKGROUND = '#1e1e1e';

@Component({
  selector: 'app-doodle-pad',
  imports: [
    HlmButton,
    ...HlmRadioGroupImports,
    TranslatePipe,
    AppCardComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  templateUrl: './doodle-pad.component.html',
  styleUrls: ['./doodle-pad.component.scss'],
})
export class DoodlePadComponent {
  readonly doodleSaved = output<string>();
  readonly cancelled = output<void>();

  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  currentColor = '#000000';
  brushWidth = 4;

  readonly colors = [
    '#000000',
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
  ];
  readonly brushWidths = [2, 4, 8, 14];

  private ctx: CanvasRenderingContext2D | null = null;
  private activePointerId: number | null = null;

  constructor() {
    afterNextRender(() => this.initialiseCanvas());
  }

  startDrawing(event: PointerEvent): void {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    const canvas = this.canvasRef().nativeElement;
    const pos = this.getPos(event);
    if (!this.ctx || !pos) return;

    event.preventDefault();
    this.activePointerId = event.pointerId;

    if (typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail when the pointer is no longer active. Drawing still works
        // because pointerup/pointerleave reset local state below.
      }
    }

    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
  }

  draw(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId || !this.ctx) return;

    const pos = this.getPos(event);
    if (!pos) return;

    event.preventDefault();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.brushWidth;
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
  }

  stopDrawing(event?: PointerEvent): void {
    if (event && this.activePointerId !== event.pointerId) return;

    const pointerId = this.activePointerId;
    this.activePointerId = null;

    if (this.ctx && pointerId !== null) {
      this.ctx.closePath();
    }

    if (pointerId === null) return;

    const canvas = this.canvasRef().nativeElement;
    if (
      typeof canvas.hasPointerCapture === 'function' &&
      typeof canvas.releasePointerCapture === 'function' &&
      canvas.hasPointerCapture(pointerId)
    ) {
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {
        // The browser may already have released capture after pointercancel/lostpointercapture.
      }
    }
  }

  clearCanvas(): void {
    this.stopDrawing();
    const canvas = this.canvasRef().nativeElement;
    if (!this.ctx) return;

    this.ctx.fillStyle = CANVAS_BACKGROUND;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  setColor(color: string | null | undefined): void {
    if (typeof color === 'string' && this.colors.includes(color)) {
      this.currentColor = color;
    }
  }

  setBrushWidth(width: number): void {
    if (this.brushWidths.includes(width)) {
      this.brushWidth = width;
    }
  }

  setBrushWidthFromValue(value: string | null | undefined): void {
    if (typeof value !== 'string') return;
    this.setBrushWidth(Number(value));
  }

  save(): void {
    this.stopDrawing();
    const dataUrl = this.canvasRef().nativeElement.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png;base64,')) return;
    this.doodleSaved.emit(dataUrl);
  }

  cancel(): void {
    this.stopDrawing();
    this.cancelled.emit();
  }

  private initialiseCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.ctx.fillStyle = CANVAS_BACKGROUND;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private getPos(event: Pick<PointerEvent, 'clientX' | 'clientY'>): { x: number; y: number } | null {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}
