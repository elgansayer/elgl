import { Test, TestingModule } from '@nestjs/testing';
import { AudioCompressionService } from './audio-compression.service';

describe('AudioCompressionService', () => {
  let service: AudioCompressionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AudioCompressionService],
    }).compile();

    service = module.get<AudioCompressionService>(AudioCompressionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compressToOgg', () => {
    it('should reject with an error when ffmpeg is not available', async () => {
      // In the test environment, fluent-ffmpeg is not installed,
      // so compressToOgg should reject with a descriptive error.
      await expect(
        service.compressToOgg('/tmp/nonexistent.wav', '/tmp/output.ogg'),
      ).rejects.toThrow('fluent-ffmpeg is not installed or available');
    });
  });

  describe('compressToM4a', () => {
    it('should reject with an error when ffmpeg is not available', async () => {
      await expect(
        service.compressToM4a('/tmp/nonexistent.wav', '/tmp/output.m4a'),
      ).rejects.toThrow('fluent-ffmpeg is not installed or available');
    });
  });
});