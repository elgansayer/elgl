import { Test, TestingModule } from '@nestjs/testing';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { HobbyTagsService } from '../hobby-tags/hobby-tags.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { LessonsService } from '../lessons/lessons.service';
import { MomentsService } from '../moments/moments.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LearnerKnowledgeService', () => {
  let service: LearnerKnowledgeService;
  let supabaseService: { getClient: ReturnType<typeof vi.fn> };
  let flashcardsService: { getFlashcards: ReturnType<typeof vi.fn> };
  let hobbyTagsService: { getUserVocabulary: ReturnType<typeof vi.fn> };
  let assessmentsService: { getQuestions: ReturnType<typeof vi.fn> };
  let lessonsService: { listLessons: ReturnType<typeof vi.fn> };
  let momentsService: { getLifetimeCounts: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              }),
            }),
          }),
        }),
      }),
    };
    flashcardsService = {
      getFlashcards: vi.fn(),
    };
    hobbyTagsService = {
      getUserVocabulary: vi.fn(),
    };
    assessmentsService = {
      getQuestions: vi.fn(),
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
        { provide: SupabaseService, useValue: supabaseService },
        { provide: FlashcardsService, useValue: flashcardsService },
        { provide: HobbyTagsService, useValue: hobbyTagsService },
        { provide: AssessmentsService, useValue: assessmentsService },
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
    it('should fetch the profile from supabase correctly', async () => {
      // Create specific mock chain for this test
      const mockSupabaseClient = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'learner_knowledge_profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { overall_proficiency: 'B2', speaking_score: '0.8' },
                error: null
              })
            };
          }
          if (table === 'knowledge_items') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              then: vi.fn((resolve) => resolve({
                data: [{ item_id: 'vocab:gato', item_type: 'vocabulary', status: 'learning', confidence_score: '1.2', error_frequency: '0.5', source_ids: {}, last_encountered_at: '2026-01-01T00:00:00Z' }],
                error: null
              }))
            };
          }
          if (table === 'recent_encounters') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [{ topic: 'Lesson 1', source: 'lesson', encountered_at: '2026-01-01T00:00:00Z' }],
                error: null
              })
            };
          }
        })
      };

      supabaseService.getClient.mockReturnValue(mockSupabaseClient);

      const profile = await service.getProfile('user1', 'es');

      // Assert profile metadata
      expect(profile.userId).toBe('user1');
      expect(profile.language).toBe('es');
      expect(profile.overallProficiency.level).toBe('B2');
      expect(profile.skills.speaking).toBe(0.8);

      // Assert knowledge items
      expect(profile.knowledgeItems.size).toBe(1);

      const known = profile.knowledgeItems.get('vocab:gato');
      expect(known?.status).toBe('learning');
      expect(known?.confidenceScore).toBe(1.2);
      expect(known?.errorFrequency).toBe(0.5);

      // Assert recent encounters
      expect(profile.recentEncounters.length).toBe(1);
      expect(profile.recentEncounters[0].topic).toBe('Lesson 1');
      expect(profile.recentEncounters[0].source).toBe('lesson');
    });

    it('should handle service failures gracefully', async () => {
      // Mock failure
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
          then: vi.fn((resolve) => resolve({ data: null, error: { message: 'db error' } }))
        })
      });

      const profile = await service.getProfile('user2', 'fr');

      expect(profile.userId).toBe('user2');
      expect(profile.language).toBe('fr');
      expect(profile.overallProficiency.level).toBe('A1');
      expect(profile.knowledgeItems.size).toBe(0);
      expect(profile.recentEncounters.length).toBe(0);
    });
  });
});
