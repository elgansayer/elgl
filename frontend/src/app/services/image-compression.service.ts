import { Injectable } from '@angular/core';

const MAX_LANDSCAPE_WIDTH = 1920;
const MAX_LANDSCAPE_HEIGHT = 1080;
const MAX_SOURCE_PIXELS = 100_000_000;
const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function jpegFilename(name: string): string {
  const trimmed = name.trim() || 'image';
  const extensionIndex = trimmed.lastIndexOf('.');
  const basename = extensionIndex > 0 ? trimmed.slice(0, extensionIndex) : trimmed;
  return `${basename}.jpg`;
}

@Injectable({
  providedIn: 'root',
})
export class ImageCompressionService {
  /**
   * Re-encodes raster images before upload while enforcing a hard 1080p ceiling.
   * Landscape images fit inside 1920x1080; portrait images fit inside 1080x1920.
   * Caller-provided dimensions may only make the output smaller than that ceiling.
   */
  async compressImage(
    file: File,
    maxWidth = MAX_LANDSCAPE_WIDTH,
    maxHeight = MAX_LANDSCAPE_HEIGHT,
    quality = 0.85,
  ): Promise<File> {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    const contentType = file.type.split(';', 1)[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
      throw new Error('Unsupported image format');
    }
    if (!Number.isFinite(maxWidth) || !Number.isFinite(maxHeight) || maxWidth <= 0 || maxHeight <= 0) {
      throw new Error('Invalid image compression dimensions');
    }
    if (!Number.isFinite(quality) || quality < MIN_QUALITY || quality > MAX_QUALITY) {
      throw new Error('Invalid image compression quality');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      let objectUrlRevoked = false;

      const revokeObjectUrl = (): void => {
        if (objectUrlRevoked) return;
        objectUrlRevoked = true;
        URL.revokeObjectURL(objectUrl);
      };

      img.onload = () => {
        revokeObjectUrl();

        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        if (
          !Number.isFinite(sourceWidth) ||
          !Number.isFinite(sourceHeight) ||
          sourceWidth <= 0 ||
          sourceHeight <= 0 ||
          sourceWidth * sourceHeight > MAX_SOURCE_PIXELS
        ) {
          reject(new Error('Image dimensions are invalid or too large'));
          return;
        }

        const isLandscape = sourceWidth >= sourceHeight;
        const hardMaxWidth = isLandscape ? MAX_LANDSCAPE_WIDTH : MAX_LANDSCAPE_HEIGHT;
        const hardMaxHeight = isLandscape ? MAX_LANDSCAPE_HEIGHT : MAX_LANDSCAPE_WIDTH;
        const effectiveMaxWidth = Math.min(maxWidth, hardMaxWidth);
        const effectiveMaxHeight = Math.min(maxHeight, hardMaxHeight);
        const ratio = Math.min(1, effectiveMaxWidth / sourceWidth, effectiveMaxHeight / sourceHeight);
        const width = Math.max(1, Math.round(sourceWidth * ratio));
        const height = Math.max(1, Math.round(sourceHeight * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image compression is unavailable in this browser'));
          return;
        }

        try {
          ctx.drawImage(img, 0, 0, width, height);
        } catch {
          reject(new Error('Failed to prepare image for compression'));
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size <= 0) {
              reject(new Error('Failed to compress image'));
              return;
            }

            resolve(
              new File([blob], jpegFilename(file.name), {
                type: 'image/jpeg',
                lastModified: file.lastModified,
              }),
            );
          },
          'image/jpeg',
          quality,
        );
      };

      img.onerror = () => {
        revokeObjectUrl();
        reject(new Error('Failed to load image for compression'));
      };

      try {
        img.src = objectUrl;
      } catch {
        revokeObjectUrl();
        reject(new Error('Failed to load image for compression'));
      }
    });
  }
}
