import { Test, TestingModule } from '@nestjs/testing';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { HobbyTagsService } from '../hobby-tags/hobby-tags.service';
import { LessonsService } from '../lessons/lessons.service';
import { MomentsService } from '../moments/moments.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LearnerKnowledgeService', () => {
  let service: LearnerKnowledgeService;
  let flashcardsService: { getFlashcards: ReturnType<typeof vi.fn> };
  let hobbyTagsService: { getUserVocabulary: ReturnType<typeof vi.fn> };
  let lessonsService: { listLessons: ReturnType<typeof vi.fn> };
  let momentsService: { getLifetimeCounts: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    flashcardsService = {
      getFlashcards: vi.fn(),
    };
    hobbyTagsService = {
      getUserVocabulary: vi.fn(),
    };
    lessonsService = {
      listLessons: vi.fn(),
    };
    momentsService = {
      getLifetimeCounts: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearnerKnowledgeService,
        { provide: FlashcardsService, useValue: flashcardsService },
        { provide: HobbyTagsService, useValue: hobbyTagsService },
        { provide: LessonsService, useValue: lessonsService },
        { provide: MomentsService, useValue: momentsService },
      ],
    }).compile();

    service = module.get<LearnerKnowledgeService>(LearnerKnowledgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should aggregate and map knowledge items and recent encounters correctly', async () => {
      // Setup mocks
      const mockFlashcards = [
        {
          word_token: 'knownWord',
          repetitions: 6,
          srs_level: 4,
          easiness_factor: 2.5,
          id: 'f1',
          next_review_at: '2026-01-01T00:00:00Z',
          translation: 'w1',
          user_id: 'user1',
          interval_days: 10,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          word_token: 'strugglingWord',
          repetitions: 2,
          srs_level: 1,
          easiness_factor: 1.5,
          id: 'f2',
          next_review_at: '2026-01-02T00:00:00Z',
          translation: 'w2',
          user_id: 'user1',
          interval_days: 2,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          word_token: 'learningWord',
          repetitions: 1,
          srs_level: 2,
          easiness_factor: 2.1,
          id: 'f3',
          next_review_at: '2026-01-03T00:00:00Z',
          translation: 'w3',
          user_id: 'user1',
          interval_days: 3,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          word_token: 'newWord',
          repetitions: 0,
          srs_level: 0,
          easiness_factor: 2.5,
          id: 'f4',
          next_review_at: '2026-01-04T00:00:00Z',
          translation: 'w4',
          user_id: 'user1',
          interval_days: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ];
      flashcardsService.getFlashcards.mockResolvedValue(mockFlashcards);

      const mockLessons = [
        { title: 'Lesson 1', created_at: '2026-01-01T10:00:00Z' },
        { title: 'Lesson 2', created_at: '2026-01-02T10:00:00Z' },
      ];
      lessonsService.listLessons.mockResolvedValue(mockLessons);

      hobbyTagsService.getUserVocabulary.mockResolvedValue([
        { word: 'hobbyWord' },
      ]);
      momentsService.getLifetimeCounts.mockResolvedValue({
        moments: 10,
        corrections: 2,
        translations: 5,
      });

      const profile = await service.getProfile('user1', 'es');

      // Assert profile metadata
      expect(profile.userId).toBe('user1');
      expect(profile.language).toBe('es');
      expect(profile.globalProficiency.level).toBe('A1'); // Should fallback to A1 regardless of user profile

      // Assert knowledge items
      expect(profile.globalKnowledgeItems.size).toBe(5);

      const known = profile.globalKnowledgeItems.get('vocab:knownWord');
      expect(known?.status).toBe('known');
      expect(known?.confidenceScore).toBe(2.5);
      expect(known?.errorFrequency).toBe(0);

      const struggling = profile.globalKnowledgeItems.get(
        'vocab:strugglingWord',
      );
      expect(struggling?.status).toBe('struggling');
      expect(struggling?.confidenceScore).toBe(1.5);
      expect(struggling?.errorFrequency).toBe(0.5);

      const learning = profile.globalKnowledgeItems.get('vocab:learningWord');
      expect(learning?.status).toBe('learning');
      expect(learning?.confidenceScore).toBe(2.1);

      const newWord = profile.globalKnowledgeItems.get('vocab:newWord');
      expect(newWord?.status).toBe('new');

      const hobbyWord = profile.globalKnowledgeItems.get('vocab:hobbyWord');
      expect(hobbyWord?.status).toBe('new');

      // Assert recent encounters
      expect(profile.globalRecentEncounters.length).toBe(2);
      expect(profile.globalRecentEncounters[0].topic).toBe('Lesson 1');
      expect(profile.globalRecentEncounters[0].source).toBe('lesson');
    });

    it('should explicitly fallback to A1 for multi-language requests until language-scoped assessments exist', async () => {
      flashcardsService.getFlashcards.mockResolvedValue([]);
      hobbyTagsService.getUserVocabulary.mockResolvedValue([]);
      lessonsService.listLessons.mockResolvedValue([]);
      momentsService.getLifetimeCounts.mockResolvedValue({
        moments: 0,
        corrections: 0,
        translations: 0,
      });

      const profileFr = await service.getProfile('user-multi', 'fr');
      const profileDe = await service.getProfile('user-multi', 'de');

      // Regardless of the invalid profile value, it should always return A1 until language-scoped assessments exist
      expect(profileFr.globalProficiency.level).toBe('A1');
      expect(profileDe.globalProficiency.level).toBe('A1');
    });

    it('should handle service failures gracefully', async () => {
      flashcardsService.getFlashcards.mockRejectedValue(
        new Error('Flashcards failed'),
      );
      hobbyTagsService.getUserVocabulary.mockRejectedValue(
        new Error('Tags failed'),
      );
      lessonsService.listLessons.mockRejectedValue(new Error('Lessons failed'));
      momentsService.getLifetimeCounts.mockRejectedValue(
        new Error('Moments failed'),
      );

      const profile = await service.getProfile('user2', 'fr');

      expect(profile.userId).toBe('user2');
      expect(profile.language).toBe('fr');
      expect(profile.globalKnowledgeItems.size).toBe(0);
      expect(profile.globalRecentEncounters.length).toBe(0);
      expect(profile.globalProficiency.level).toBe('A1');
    });
  });
});
