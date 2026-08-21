import { Component, inject, signal, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { SupabaseService } from '../../services/supabase.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-avatar-upload',
  imports: [TranslatePipe, AppButtonPrimaryComponent, AppButtonSecondaryComponent],
  templateUrl: './avatar-upload.component.html',
  styleUrls: ['./avatar-upload.component.scss'],
})
export class AvatarUploadComponent {
  private readonly supabaseService = inject(SupabaseService);

  readonly avatarUrl = output<string>();

  readonly uploading = signal(false);
  readonly previewUrl = signal<string | null>(null);

  // Crop state (display pixel coordinates)
  readonly cropX = signal(0);
  readonly cropY = signal(0);
  readonly cropSize = signal(0);

  readonly displayWidth = signal(0);
  readonly displayHeight = signal(0);
  readonly naturalWidth = signal(0);
  readonly naturalHeight = signal(0);

  private startX = 0;
  private startY = 0;
  private isDragging = false;
  private fileBuffer!: ArrayBuffer;
  private imageElement!: HTMLImageElement;

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.files?.length) return;

    const file = input.files[0];
    const arrayBuffer = await file.arrayBuffer();
    this.fileBuffer = arrayBuffer;

    // Load image to get native dimensions
    const img = new Image();
    const blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
    img.src = blobUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });
    URL.revokeObjectURL(blobUrl);
    this.imageElement = img;

    this.naturalWidth.set(img.naturalWidth);
    this.naturalHeight.set(img.naturalHeight);

    this.previewUrl.set(blobUrl);
  }

  // Called when the <img> inside the template has finished loading
  onImageLoad(event: Event): void {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const dw = img.clientWidth;
    const dh = img.clientHeight;
    this.displayWidth.set(dw);
    this.displayHeight.set(dh);

    // Initial centred square crop (in display coordinates)
    const dSize = Math.min(dw, dh);
    const dx = Math.max(0, (dw - dSize) / 2);
    const dy = Math.max(0, (dh - dSize) / 2);
    this.cropX.set(dx);
    this.cropY.set(dy);
    this.cropSize.set(dSize);
  }

  onImageMouseDown(event: MouseEvent): void {
    // Start dragging a new square
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    this.isDragging = true;
    event.preventDefault?.();
  }

  onImageMouseMove(event: MouseEvent): void {
    if (!this.isDragging) {
      return;
    }
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    const curX = event.clientX - rect.left;
    const curY = event.clientY - rect.top;

    const dx = curX - this.startX;
    const dy = curY - this.startY;

    const size = Math.min(Math.abs(dx), Math.abs(dy));
    let x: number, y: number;

    if (dx >= 0) {
      x = this.startX;
    } else {
      x = this.startX - size;
    }
    if (dy >= 0) {
      y = this.startY;
    } else {
      y = this.startY - size;
    }

    const maxW = rect.width;
    const maxH = rect.height;
    // Clamp to image bounds
    x = Math.max(0, Math.min(x, maxW - size));
    y = Math.max(0, Math.min(y, maxH - size));

    this.cropX.set(x);
    this.cropY.set(y);
    this.cropSize.set(size);

    event.preventDefault?.();
  }

  onImageMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      event.preventDefault?.();
    }
  }

  async confirmCrop(): Promise<void> {
    this.uploading.set(true);
    try {
      const scaleX = this.naturalWidth() / (this.displayWidth() || 1);
      const scaleY = this.naturalHeight() / (this.displayHeight() || 1);
      const srcX = this.cropX() * scaleX;
      const srcY = this.cropY() * scaleY;
      const srcSize = this.cropSize() * Math.min(scaleX, scaleY);

      // 1. Create canvas with destination size (square)
      const canvas = document.createElement('canvas');
      canvas.width = srcSize;
      canvas.height = srcSize;
      const ctx = canvas.getContext('2d')!;

      // 2. Draw the selected region from the original image
      ctx.drawImage(this.imageElement, srcX, srcY, srcSize, srcSize, 0, 0, srcSize, srcSize);

      // 3. Convert canvas to Blob (PNG)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      );

      // 4. Create a File from the Blob
      const croppedFile = new File([blob], 'avatar-cropped.png', {
        type: 'image/png',
      });

      // 5. Upload via Supabase service
      const url = await this.supabaseService.uploadAvatar(croppedFile);

      // 6. Emit the resulting URL
      if (url) {
        this.avatarUrl.emit(url);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      this.uploading.set(false);
    }
  }
}
