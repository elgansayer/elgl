import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImageCompressionService } from './image-compression.service';

function createMockFile(
  type: string = 'image/png',
  name: string = 'test.png',
): File {
  const content = new Uint8Array(1024);
  return new File([content], name, { type });
}

describe('ImageCompressionService', () => {
  let service: ImageCompressionService;
  let originalImage: typeof Image;

  beforeEach(() => {
    service = new ImageCompressionService();
    originalImage = globalThis.Image;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return non-image files unchanged', async () => {
    const file = createMockFile('video/mp4', 'video.mp4');
    const result = await service.compressImage(file);
    expect(result).toBe(file);
  });

  it('should return audio files unchanged', async () => {
    const file = createMockFile('audio/ogg', 'audio.ogg');
    const result = await service.compressImage(file);
    expect(result).toBe(file);
  });

  it('should attempt compression for image files and return a File', async () => {
    // Mock Image constructor to auto-fire onload
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
      get src(): string { return ''; }
    } as unknown as typeof Image;

    // Canvas not available in jsdom, so getContext returns null and service
    // falls back to returning the original file.
    const file = new File(['fake-png-data'], 'test.png', { type: 'image/png' });
    const result = await service.compressImage(file);

    // Service returns original file when canvas is unavailable (graceful fallback)
    expect(result).toBeInstanceOf(File);
    expect(result).toBe(file);
  });

  it('should compress and return a JPEG File when canvas is available', async () => {
    // Mock canvas getContext
    const mockCtx = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.getContext = function (): any {
      return mockCtx;
    };
    HTMLCanvasElement.prototype.toBlob = function (callback: (blob: Blob | null) => void) {
      const blob = new Blob(['mock-jpeg'], { type: 'image/jpeg' });
      callback(blob);
    };

    // Mock Image constructor to auto-fire onload
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
      get src(): string { return ''; }
    } as unknown as typeof Image;

    const file = new File(['fake-png-data'], 'photo.png', { type: 'image/png' });
    const result = await service.compressImage(file);

    expect(result).toBeInstanceOf(File);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toMatch(/\.jpg$/);

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
  });
});