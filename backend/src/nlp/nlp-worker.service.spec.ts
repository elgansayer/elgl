import { Test, TestingModule } from '@nestjs/testing';
import { NlpWorkerService } from './nlp-worker.service';
import { NlpService } from './nlp.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('NlpWorkerService', () => {
  let service: NlpWorkerService;
  let nlpService: { generateSessionSummary: any };
  let flashcardsService: { createFlashcard: any };

  beforeEach(async () => {
    nlpService = {
      generateSessionSummary: vi.fn(),
    };

    flashcardsService = {
      createFlashcard: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NlpWorkerService,
        { provide: NlpService, useValue: nlpService },
        { provide: FlashcardsService, useValue: flashcardsService },
      ],
    }).compile();

    service = module.get<NlpWorkerService>(NlpWorkerService);
  });

  it('should process session transcript and create flashcards', async () => {
    nlpService.generateSessionSummary.mockResolvedValue({
      summary: 'Test summary',
      vocabulary: ['word1', 'word2'],
    });

    flashcardsService.createFlashcard.mockResolvedValue({});

    await service.processSessionTranscript('user-1', 'This is a test transcript.');

    expect(nlpService.generateSessionSummary).toHaveBeenCalledWith('This is a test transcript.');
    expect(flashcardsService.createFlashcard).toHaveBeenCalledTimes(2);
    expect(flashcardsService.createFlashcard).toHaveBeenCalledWith('user-1', {
      word_token: 'word1',
      translation: 'Auto-extracted from conversation',
    });
    expect(flashcardsService.createFlashcard).toHaveBeenCalledWith('user-1', {
      word_token: 'word2',
      translation: 'Auto-extracted from conversation',
    });
  });

  it('should ignore empty transcripts', async () => {
    await service.processSessionTranscript('user-1', '   ');
    expect(nlpService.generateSessionSummary).not.toHaveBeenCalled();
  });
});
