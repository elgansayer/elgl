import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import {
  Component,
  ElementRef,
  output,
  viewChild,
  afterNextRender,
} from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

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
  doodleSaved = output<string>();
  cancelled = output<void>();

  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;

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

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      canvas.width = 600;
      canvas.height = 400;
      this.ctx = canvas.getContext('2d');
      if (this.ctx) {
        this.ctx.fillStyle = '#1e1e1e';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
      }
    });
  }

  startDrawing(event: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    const pos = this.getPos(event);
    if (this.ctx && pos) {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    }
  }

  draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.ctx) return;
    const pos = this.getPos(event);
    if (pos) {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.brushWidth;
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    }
  }

  stopDrawing(): void {
    if (this.isDrawing && this.ctx) {
      this.ctx.closePath();
      this.isDrawing = false;
    }
  }

  clearCanvas(): void {
    if (!this.ctx || !this.canvasRef()) return;
    const canvas = this.canvasRef().nativeElement;
    this.ctx.fillStyle = '#1e1e1e';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  setColor(color: string | null | undefined): void {
    if (typeof color === 'string' && this.colors.includes(color)) {
      this.currentColor = color;
    }
  }

  setBrushWidth(width: number): void {
    this.brushWidth = width;
  }

  setBrushWidthFromValue(value: string | null | undefined): void {
    if (typeof value === 'string') {
      const width = Number(value);
      if (this.brushWidths.includes(width)) {
        this.setBrushWidth(width);
      }
    }
  }

  save(): void {
    if (!this.canvasRef()) return;
    const dataUrl = this.canvasRef().nativeElement.toDataURL('image/png');
    this.doodleSaved.emit(dataUrl);
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private getPos(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    if (!this.canvasRef()) return null;
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      return null;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
}
