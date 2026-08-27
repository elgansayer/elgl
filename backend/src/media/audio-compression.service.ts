/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports */
import { Injectable, Logger } from '@nestjs/common';

let ffmpeg: any;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch {
  // Fallback for test environments where fluent-ffmpeg might not be available
  ffmpeg = null;
}

@Injectable()
export class AudioCompressionService {
  private readonly logger = new Logger(AudioCompressionService.name);

  compressToOgg(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        return reject(new Error('fluent-ffmpeg is not installed or available'));
      }
      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioBitrate('32k')
        .audioChannels(1)
        .format('ogg')
        .on('start', (cmd: string) =>
          this.logger.debug(`Started FFmpeg: ${cmd}`),
        )
        .on('end', () => {
          this.logger.log(`Successfully compressed to OGG: ${outputPath}`);
          resolve();
        })
        .on('error', (err: any) => {
          const error = err instanceof Error ? err : new Error(String(err));
          this.logger.error(`FFmpeg Error: ${error.message}`);
          reject(error);
        })
        .save(outputPath);
    });
  }

  compressToM4a(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        return reject(new Error('fluent-ffmpeg is not installed or available'));
      }
      ffmpeg(inputPath)
        .audioCodec('aac')
        .audioBitrate('64k')
        .audioChannels(1)
        .format('mp4')
        .on('start', (cmd: string) =>
          this.logger.debug(`Started FFmpeg: ${cmd}`),
        )
        .on('end', () => {
          this.logger.log(`Successfully compressed to M4A: ${outputPath}`);
          resolve();
        })
        .on('error', (err: any) => {
          const error = err instanceof Error ? err : new Error(String(err));
          this.logger.error(`FFmpeg Error: ${error.message}`);
          reject(error);
        })
        .save(outputPath);
    });
  }
}
