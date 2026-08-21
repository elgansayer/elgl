import type { Mocked } from 'vitest';
import { Test } from '@nestjs/testing';
import { PronunciationController } from './pronunciation.controller';
import { PronunciationService } from './pronunciation.service';

type AnalyseResult = Awaited<ReturnType<PronunciationService['analyse']>>;

describe('PronunciationController', () => {
  let controller: PronunciationController;
  let service: Mocked<PronunciationService>;

  const mockAudio = {
    buffer: Buffer.from('audio-data'),
    originalname: 'speech.wav',
    mimetype: 'audio/wav',
    size: 10,
  } as Express.Multer.File;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PronunciationController],
      providers: [
        {
          provide: PronunciationService,
          useValue: {
            analyse: vi.fn(),
            processVoiceFeedback: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<PronunciationController>(
      PronunciationController,
    );
    service = moduleRef.get<PronunciationService>(
      PronunciationService,
    ) as Mocked<PronunciationService>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getFeedback', () => {
    it('should call analyse with audio and referenceText and return feedback', async () => {
      const referenceText = 'Hello world';
      const expected = {} as unknown as AnalyseResult;
      service.analyse.mockResolvedValue(expected);

      const result = await controller.getFeedback(mockAudio, referenceText);

      expect(service.analyse).toHaveBeenCalledWith(mockAudio, referenceText);
      expect(result).toEqual(expected);
    });

    it('should call analyse when referenceText is omitted', async () => {
      const expected = {} as unknown as AnalyseResult;
      service.analyse.mockResolvedValue(expected);

      const result = await controller.getFeedback(mockAudio, undefined);

      expect(service.analyse).toHaveBeenCalledWith(mockAudio, undefined);
      expect(result).toEqual(expected);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('analysis failed');
      service.analyse.mockRejectedValue(error);

      await expect(controller.getFeedback(mockAudio, 'hello')).rejects.toThrow(
        error,
      );
      expect(service.analyse).toHaveBeenCalledWith(mockAudio, 'hello');
    });
  });

  describe('submitVoiceFeedback', () => {
    it('should call processVoiceFeedback with audio and feedbackText', async () => {
      const feedbackText = 'Please improve intonation';
      service.processVoiceFeedback.mockResolvedValue({ success: true });

      const result = await controller.submitVoiceFeedback(
        mockAudio,
        feedbackText,
      );

      expect(service.processVoiceFeedback).toHaveBeenCalledWith(
        mockAudio,
        feedbackText,
      );
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from processVoiceFeedback', async () => {
      const error = new Error('voice feedback failed');
      service.processVoiceFeedback.mockRejectedValue(error);

      await expect(
        controller.submitVoiceFeedback(mockAudio, 'some feedback'),
      ).rejects.toThrow(error);
      expect(service.processVoiceFeedback).toHaveBeenCalledWith(
        mockAudio,
        'some feedback',
      );
    });
  });
});
