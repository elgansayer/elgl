import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageCompressionService {
  async compress(inputBuffer: Buffer, mimeType: string): Promise<Buffer> {
    // Resize to max 1920px while maintaining aspect ratio
    let pipeline = sharp(inputBuffer).resize({
      width: 1920,
      height: 1920,
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    });

    // Choose output format based on input mime type
    switch (mimeType) {
      case 'image/jpeg':
        pipeline = pipeline.jpeg({ quality: 80 });
        break;
      case 'image/png':
        pipeline = pipeline.png({ quality: 80, compressionLevel: 6 });
        break;
      case 'image/webp':
        pipeline = pipeline.webp({ quality: 80 });
        break;
      default:
        pipeline = pipeline.jpeg({ quality: 80 });
    }

    return pipeline.toBuffer();
  }
}
