import { expect, describe, it, vi, beforeEach } from 'vitest';
import { InterestsService } from './interests.service';

describe('InterestsService', () => {
  let service: InterestsService;
  let mockSupabaseClient: any;
  let mockLlmProxyService: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: vi.fn(),
    };
    mockLlmProxyService = {
      proxyMessage: vi.fn(),
    };

    service = new InterestsService(
      { getClient: () => mockSupabaseClient } as any,
      mockLlmProxyService,
    );
  });

  describe('generateFlashcards', () => {
    it('creates interest flashcards idempotently with LLM fallback', async () => {
      let selectCounter = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockImplementation(() => {
            selectCounter++;
            if (selectCounter === 1) {
              return Promise.resolve({ data: [{ interest_id: 'i1' }] });
            } else {
              return Promise.resolve({
                data: [
                  { word: 'Word1', translation: 'Trans1' },
                  { word: 'Word2', translation: 'Trans2' },
                ],
              });
            }
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockLlmProxyService.proxyMessage.mockResolvedValue({ response: 'Test sentence.' });

      await service.generateFlashcards('user-1', 'es');

      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
    });

    it('respects concurrency and limits when creating flashcards', async () => {
      let selectCounter = 0;
      const massiveVocabList = Array.from({ length: 50 }, (_, i) => ({ word: `Word${i}`, translation: `Trans${i}` }));

      mockSupabaseClient.from.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockImplementation(() => {
            selectCounter++;
            if (selectCounter === 1) {
              return Promise.resolve({ data: [{ interest_id: 'i1' }] });
            } else {
              return Promise.resolve({ data: massiveVocabList });
            }
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockLlmProxyService.proxyMessage.mockResolvedValue({ response: 'Test sentence.' });

      await service.generateFlashcards('user-1', 'es');

      // Should cap at 20 processing limit (MAX_VOCAB_PROCESS_LIMIT)
      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledTimes(20);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
    });

    it('rejects malformed instruction-like sentences from LLM', async () => {
      let selectCounter = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          returns: vi.fn().mockImplementation(() => {
            selectCounter++;
            if (selectCounter === 1) {
              return Promise.resolve({ data: [{ interest_id: 'i1' }] });
            } else {
              return Promise.resolve({
                data: [
                  { word: 'Word1', translation: 'Trans1' },
                ],
              });
            }
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockLlmProxyService.proxyMessage.mockResolvedValue({ response: 'Here is a sentence: El gato.' });

      await service.generateFlashcards('user-1', 'es');

      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledTimes(1);
      // The upsert should have been called with an empty context_sentence because it was rejected
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      const upsertMock = mockSupabaseClient.from.mock.results[mockSupabaseClient.from.mock.results.length - 1].value.upsert;
      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            context_sentence: '',
          }),
        ]),
        expect.any(Object)
      );
    });
  });
});
