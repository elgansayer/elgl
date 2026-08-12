import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsService } from './assessments.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let supabaseService: { getClient: Mock };

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQuestions', () => {
    it('should return questions from Supabase when available', async () => {
      const mockQuestions = [
        {
          id: 'test-id',
          question_text: 'Test question?',
          language: 'en',
          options: [{ id: 'o1', text: 'Option 1', points: 1 }],
          correct_option_id: 'o1',
          skill_area: 'speaking',
          category: 'self_assessment',
          difficulty_level: 1,
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockQuestions,
            error: null,
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await service.getQuestions('en');
      expect(result).toEqual(mockQuestions);
      expect(result.length).toBe(1);
    });

    it('should return fallback questions on Supabase error', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await service.getQuestions('en');
      expect(result.length).toBe(10);
      expect(result[0].id).toBe('q1');
    });

    it('should return fallback questions when no data returned', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await service.getQuestions('en');
      expect(result.length).toBe(10);
    });

    it('should default language to en', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      await service.getQuestions();
      // Should not throw and return fallback
      const result = await service.getQuestions();
      expect(result.length).toBe(10);
    });
  });

  describe('getFallbackQuestions', () => {
    it('should return 10 fallback questions', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await service.getQuestions('en');
      expect(result).toHaveLength(10);
      result.forEach((q) => {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('question_text');
        expect(q).toHaveProperty('options');
        expect(q).toHaveProperty('correct_option_id');
        expect(q).toHaveProperty('skill_area');
        expect(q).toHaveProperty('category');
        expect(q).toHaveProperty('difficulty_level');
      });
    });

    it('should have valid options with points for each fallback question', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      });

      const result = await service.getQuestions('en');
      result.forEach((q) => {
        expect(q.options.length).toBeGreaterThan(0);
        q.options.forEach((opt) => {
          expect(opt).toHaveProperty('id');
          expect(opt).toHaveProperty('text');
          expect(opt).toHaveProperty('points');
          expect(typeof opt.points).toBe('number');
        });
      });
    });
  });
});
