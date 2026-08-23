/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

let ffmpeg: any;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch {
  ffmpeg = null;
}

@Injectable()
export class VideoCompressionService {
  private readonly logger = new Logger(VideoCompressionService.name);

  /**
   * Produce the bandwidth-friendly standard-quality derivative used by chat.
   * HD uploads intentionally bypass this method and preserve the original bytes.
   */
  compressToStandardMp4(inputPath: string, outputPath: string): Promise<void> {
    if (!ffmpeg) {
      throw new ServiceUnavailableException('Video processing is temporarily unavailable');
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate('1600k')
        .audioBitrate('96k')
        .size('?x720')
        .outputOptions(['-preset veryfast', '-movflags +faststart', '-pix_fmt yuv420p'])
        .format('mp4')
        .on('end', () => resolve())
        .on('error', (error: unknown) => {
          this.logger.warn('Standard chat video transcode failed');
          reject(
            error instanceof Error
              ? error
              : new ServiceUnavailableException('Video processing failed'),
          );
        })
        .save(outputPath);
    });
  }
}
