import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class AudioCompressionService {
  private readonly logger = new Logger(AudioCompressionService.name);

  compressToOgg(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioBitrate('32k')
        .audioChannels(1)
        .format('ogg')
        .on('start', (cmd) => this.logger.debug(`Started FFmpeg: ${cmd}`))
        .on('end', () => {
          this.logger.log(`Successfully compressed to OGG: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg Error: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  }

  compressToM4a(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('aac')
        .audioBitrate('64k')
        .audioChannels(1)
        .format('mp4')
        .on('start', (cmd) => this.logger.debug(`Started FFmpeg: ${cmd}`))
        .on('end', () => {
          this.logger.log(`Successfully compressed to M4A: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg Error: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  }
}
