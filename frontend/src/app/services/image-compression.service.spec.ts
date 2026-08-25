import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCompressionService } from './image-compression.service';

function createMockFile(type = 'image/png', name = 'test.png'): File {
  return new File([new Uint8Array(1024)], name, { type, lastModified: 1234 });
}

function installMockImage(width: number, height: number, fail = false): void {
  globalThis.Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = width;
    height = height;
    naturalWidth = width;
    naturalHeight = height;

    set src(_value: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }

    get src(): string {
      return '';
    }
  } as unknown as typeof Image;
}

describe('ImageCompressionService', () => {
  let service: ImageCompressionService;
  let originalImage: typeof Image;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob;

  beforeEach(() => {
    service = new ImageCompressionService();
    originalImage = globalThis.Image;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;

    URL.createObjectURL = vi.fn(() => 'blob:compression-test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    vi.restoreAllMocks();
  });

  function installCanvas(blob: Blob | null = new Blob(['jpeg'], { type: 'image/jpeg' })) {
    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = function (): CanvasRenderingContext2D {
      return { drawImage } as unknown as CanvasRenderingContext2D;
    } as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback): void {
      callback(blob);
    };
    return { drawImage };
  }

  it('returns non-image files unchanged', async () => {
    const file = createMockFile('video/mp4', 'video.mp4');
    await expect(service.compressImage(file)).resolves.toBe(file);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects unsupported image formats before decoding', async () => {
    const file = createMockFile('image/svg+xml', 'vector.svg');
    await expect(service.compressImage(file)).rejects.toThrow('Unsupported image format');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('enforces a 1920x1080 landscape ceiling even when callers request larger output', async () => {
    installMockImage(4000, 3000);
    const { drawImage } = installCanvas();

    const result = await service.compressImage(createMockFile('image/png', 'holiday.png'), 2560, 2560, 0.9);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 1080);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('holiday.jpg');
    expect(result.lastModified).toBe(1234);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:compression-test');
  });

  it('uses the rotated 1080x1920 ceiling for portrait images', async () => {
    installMockImage(3000, 4000);
    const { drawImage } = installCanvas();

    await service.compressImage(createMockFile(), 2560, 2560, 0.9);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1080, 1440);
  });

  it('does not upscale an image that is already inside the requested bounds', async () => {
    installMockImage(800, 600);
    const { drawImage } = installCanvas();

    await service.compressImage(createMockFile(), 1920, 1080);

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  });

  it('fails closed when canvas compression is unavailable instead of uploading the original image', async () => {
    installMockImage(2000, 1200);
    HTMLCanvasElement.prototype.getContext = function (): null {
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;

    await expect(service.compressImage(createMockFile())).rejects.toThrow(
      'Image compression is unavailable in this browser',
    );
  });

  it('fails closed when JPEG encoding produces no bytes', async () => {
    installMockImage(2000, 1200);
    installCanvas(null);

    await expect(service.compressImage(createMockFile())).rejects.toThrow('Failed to compress image');
  });

  it('rejects invalid dimensions and quality without decoding private image content', async () => {
    const file = createMockFile();

    await expect(service.compressImage(file, 0, 1080)).rejects.toThrow(
      'Invalid image compression dimensions',
    );
    await expect(service.compressImage(file, 1920, 1080, 1.1)).rejects.toThrow(
      'Invalid image compression quality',
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects pathological decoded dimensions before allocating a canvas', async () => {
    installMockImage(20_000, 20_000);
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');

    await expect(service.compressImage(createMockFile())).rejects.toThrow(
      'Image dimensions are invalid or too large',
    );
    expect(getContext).not.toHaveBeenCalled();
  });

  it('revokes the object URL when the browser cannot decode the image', async () => {
    installMockImage(0, 0, true);

    await expect(service.compressImage(createMockFile())).rejects.toThrow(
      'Failed to load image for compression',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:compression-test');
  });
});
