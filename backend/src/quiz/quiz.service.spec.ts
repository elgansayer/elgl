import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('QuizService', () => {
  let service: QuizService;
  let supabaseService: { getClient: Mock };

  const mockAssessmentRows = [
    {
      id: 'db-q1',
      question_text:
        'How well can you introduce yourself and answer basic questions?',
      language: 'en',
      options: [
        { id: 'o1', text: 'I struggle to understand and reply.', points: 1 },
        {
          id: 'o2',
          text: 'I can do it with simple phrases if the other person speaks slowly.',
          points: 2,
        },
        { id: 'o3', text: 'I can do it easily and confidently.', points: 3 },
        {
          id: 'o4',
          text: 'I can do it fluently and naturally, adapting to context.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'speaking',
      difficulty_level: 1,
    },
    {
      id: 'db-q2',
      question_text:
        'Can you understand the main points of clear standard input?',
      language: 'en',
      options: [
        {
          id: 'o1',
          text: 'No, I need translation for most things.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'Yes, if the topic is very familiar to me.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'Yes, I understand almost everything clearly.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'Yes, I understand complex and nuanced content effortlessly.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'listening',
      difficulty_level: 2,
    },
    {
      id: 'db-q3',
      question_text: 'How comfortable are you expressing your opinions?',
      language: 'en',
      options: [
        { id: 'o1', text: 'I cannot do this yet.', points: 1 },
        {
          id: 'o2',
          text: 'I can give brief reasons and explanations.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I can express myself fluently and spontaneously.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can present complex arguments with precision.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'speaking',
      difficulty_level: 3,
    },
    {
      id: 'db-q4',
      question_text: 'How well do you understand extended speech and lectures?',
      language: 'en',
      options: [
        {
          id: 'o1',
          text: 'I can only follow if spoken slowly and clearly.',
          points: 1,
        },
        { id: 'o2', text: 'I understand most of the main ideas.', points: 2 },
        {
          id: 'o3',
          text: 'I understand complex arguments and nuanced meanings.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I understand all nuances, accents, and implied meanings.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'listening',
      difficulty_level: 4,
    },
    {
      id: 'db-q5',
      question_text: 'How confident are you writing clear, detailed text?',
      language: 'en',
      options: [
        {
          id: 'o1',
          text: 'I can only write simple isolated phrases.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I can write connected text on familiar topics.',
          points: 2,
        },
        { id: 'o3', text: 'I can write well-structured text.', points: 3 },
        {
          id: 'o4',
          text: 'I can write sophisticated, stylistically appropriate texts.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'writing',
      difficulty_level: 5,
    },
    {
      id: 'db-q6',
      question_text: 'How naturally can you interact in a conversation?',
      language: 'en',
      options: [
        { id: 'o1', text: 'I struggle to keep up.', points: 1 },
        {
          id: 'o2',
          text: 'I can handle most situations with pauses.',
          points: 2,
        },
        { id: 'o3', text: 'I interact fluently and spontaneously.', points: 3 },
        {
          id: 'o4',
          text: 'I participate effortlessly in any conversation.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'speaking',
      difficulty_level: 5,
    },
    {
      id: 'db-q7',
      question_text: 'How well can you read and understand authentic texts?',
      language: 'en',
      options: [
        {
          id: 'o1',
          text: 'I can only understand very short, simple texts.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I understand contemporary prose and articles.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I read complex literary and technical texts with ease.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I read and critically analyse any text.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'reading',
      difficulty_level: 3,
    },
    {
      id: 'db-q8',
      question_text: 'How accurately can you use grammar structures?',
      language: 'en',
      options: [
        { id: 'o1', text: 'I make frequent basic errors.', points: 1 },
        {
          id: 'o2',
          text: 'I am generally accurate with occasional errors.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I use grammar accurately and appropriately.',
          points: 3,
        },
        { id: 'o4', text: 'I use grammar flawlessly.', points: 4 },
      ],
      correct_option_id: 'o3',
      skill_area: 'grammar',
      difficulty_level: 4,
    },
    {
      id: 'db-q9',
      question_text: 'How wide is your vocabulary range?',
      language: 'en',
      options: [
        {
          id: 'o1',
          text: 'I rely on a limited set of basic words.',
          points: 1,
        },
        {
          id: 'o2',
          text: 'I have enough vocabulary for everyday topics.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I have a broad vocabulary and use idiomatic expressions.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I have an extensive vocabulary with precision.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'vocabulary',
      difficulty_level: 2,
    },
    {
      id: 'db-q10',
      question_text:
        'How well can you summarise information from different sources?',
      language: 'en',
      options: [
        { id: 'o1', text: 'I find summarising very difficult.', points: 1 },
        {
          id: 'o2',
          text: 'I can summarise the main points from simple sources.',
          points: 2,
        },
        {
          id: 'o3',
          text: 'I can reconstruct arguments coherently.',
          points: 3,
        },
        {
          id: 'o4',
          text: 'I can synthesise information into original summaries.',
          points: 4,
        },
      ],
      correct_option_id: 'o3',
      skill_area: 'writing',
      difficulty_level: 1,
    },
  ];

  function createMockSupabaseClient(
    data: unknown = mockAssessmentRows,
    error: unknown = null,
  ) {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
      }),
    });
    return { from: vi.fn().mockReturnValue({ select: mockSelect }) };
  }

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn().mockReturnValue(createMockSupabaseClient()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  describe('getQuestions', () => {
    it('should return an array of questions', async () => {
      const questions = await service.getQuestions('en');
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should return questions with correct structure', async () => {
      const questions = await service.getQuestions('en');
      for (const q of questions) {
        expect(q.id).toBeDefined();
        expect(q.text).toBeDefined();
        expect(q.skill).toBeDefined();
        expect(q.category).toBeDefined();
        expect(q.options.length).toBeGreaterThan(0);
        for (const opt of q.options) {
          expect(opt.id).toBeDefined();
          expect(opt.text).toBeDefined();
          expect(typeof opt.points).toBe('number');
        }
      }
    });

    it('should return 10 questions covering multiple skills', async () => {
      const questions = await service.getQuestions('en');
      expect(questions.length).toBe(10);
      const skills = new Set(questions.map((q) => q.skill));
      expect(skills.size).toBeGreaterThanOrEqual(4);
    });

    it('should map assessment rows to QuizQuestion format', async () => {
      const questions = await service.getQuestions('en');
      expect(questions[0].id).toBe('db-q1');
      expect(questions[0].text).toBe(
        'How well can you introduce yourself and answer basic questions?',
      );
      expect(questions[0].skill).toBe('speaking');
      expect(questions[0].category).toBe('self-assessment');
    });

    it('should return fallback questions on Supabase error', async () => {
      supabaseService.getClient.mockReturnValue(
        createMockSupabaseClient(null, { message: 'Database error' }),
      );
      const questions = await service.getQuestions('en');
      expect(questions.length).toBe(10);
      expect(questions[0].id).toBe('q1');
    });

    it('should return fallback questions when no data returned', async () => {
      supabaseService.getClient.mockReturnValue(createMockSupabaseClient([]));
      const questions = await service.getQuestions('en');
      expect(questions.length).toBe(10);
      expect(questions[0].id).toBe('q1');
    });

    it('should default language to en', async () => {
      const questions = await service.getQuestions();
      expect(questions.length).toBe(10);
    });
  });

  describe('evaluateResults', () => {
    const testQuestions = mockAssessmentRows.map((row) => ({
      id: row.id,
      text: row.question_text,
      skill: row.skill_area,
      category: 'self-assessment',
      options: row.options,
    }));

    it('should compute total score and percentage', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 4,
        'db-q2': 3,
        'db-q3': 2,
        'db-q4': 4,
        'db-q5': 3,
        'db-q6': 4,
        'db-q7': 2,
        'db-q8': 3,
        'db-q9': 1,
        'db-q10': 2,
      });
      expect(result.totalScore).toBe(28);
      expect(result.maxScore).toBe(40);
      expect(result.percentage).toBe(70);
    });

    it('should return A1 for very low scores', () => {
      const result = service.evaluateResults(testQuestions, 'en', {});
      expect(result.suggestedCefr).toBe('A1');
      expect(result.percentage).toBe(0);
    });

    it('should return A2 for low beginner scores', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 1,
        'db-q2': 1,
        'db-q3': 1,
        'db-q4': 1,
        'db-q5': 1,
        'db-q6': 1,
        'db-q7': 1,
        'db-q8': 1,
        'db-q9': 1,
        'db-q10': 1,
      });
      expect(result.suggestedCefr).toBe('A2');
      expect(result.percentage).toBe(25);
    });

    it('should return C2 for very high scores', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 4,
        'db-q2': 4,
        'db-q3': 4,
        'db-q4': 4,
        'db-q5': 4,
        'db-q6': 4,
        'db-q7': 4,
        'db-q8': 4,
        'db-q9': 4,
        'db-q10': 4,
      });
      expect(result.suggestedCefr).toBe('C2');
      expect(result.percentage).toBeGreaterThanOrEqual(90);
    });

    it('should return B2 for mid-range scores', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 3,
        'db-q2': 3,
        'db-q3': 2,
        'db-q4': 3,
        'db-q5': 2,
        'db-q6': 3,
        'db-q7': 2,
        'db-q8': 3,
        'db-q9': 3,
        'db-q10': 2,
      });
      expect(result.suggestedCefr).toBe('B2');
    });

    it('should handle missing answers', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 4,
        'db-q2': 3,
      });
      expect(result.totalScore).toBe(7);
      expect(result.maxScore).toBe(40);
    });

    it('should provide skill breakdown', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 4,
        'db-q2': 3,
        'db-q3': 2,
        'db-q4': 4,
        'db-q5': 3,
        'db-q6': 2,
        'db-q7': 1,
        'db-q8': 3,
        'db-q9': 4,
        'db-q10': 2,
      });
      expect(result.skillBreakdown).toBeDefined();
      expect(result.skillBreakdown['speaking']).toBeDefined();
      expect(result.skillBreakdown['reading']).toBeDefined();
      expect(result.skillBreakdown['writing']).toBeDefined();
      expect(result.skillBreakdown['listening']).toBeDefined();
      expect(result.skillBreakdown['grammar']).toBeDefined();
      expect(result.skillBreakdown['vocabulary']).toBeDefined();
    });

    it('should include a description in the result', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'db-q1': 4,
        'db-q2': 4,
        'db-q3': 4,
        'db-q4': 4,
        'db-q5': 4,
        'db-q6': 4,
        'db-q7': 4,
        'db-q8': 4,
        'db-q9': 4,
        'db-q10': 4,
      });
      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should handle questions not in the provided set', () => {
      const result = service.evaluateResults(testQuestions, 'en', {
        'nonexistent-id': 4,
      });
      expect(result.totalScore).toBe(0);
      expect(result.maxScore).toBe(40);
    });
  });
});
