import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { QuizService } from './quiz.service';

const rows = [
  {
    id: 'q1',
    question_text: 'How comfortable are you speaking?',
    language: 'en',
    options: [
      { id: 'low', text: 'Not yet', points: 1 },
      { id: 'high', text: 'Very comfortable', points: 4 },
    ],
    skill_area: 'speaking',
    category: 'self_assessment',
    difficulty_level: 1,
  },
  {
    id: 'q2',
    question_text: 'How comfortable are you reading?',
    language: 'en',
    options: [
      { id: 'low', text: 'Not yet', points: 1 },
      { id: 'high', text: 'Very comfortable', points: 4 },
    ],
    skill_area: 'reading',
    category: 'self_assessment',
    difficulty_level: 2,
  },
];

describe('QuizService', () => {
  let service: QuizService;
  let getClient: Mock;
  let updateEq: Mock;
  let questionResults: Map<string, { data: unknown; error: unknown }>;

  beforeEach(async () => {
    updateEq = vi.fn().mockResolvedValue({ error: null });
    questionResults = new Map([
      ['en', { data: rows, error: null }],
      ['ja', { data: [], error: null }],
    ]);

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { update: vi.fn().mockReturnValue({ eq: updateEq }) };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((_column: string, language: string) => ({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  questionResults.get(language) ?? { data: [], error: null },
                ),
              }),
            })),
          }),
        };
      }),
    };
    getClient = vi.fn().mockReturnValue(client);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: SupabaseService, useValue: { getClient } },
      ],
    }).compile();
    service = module.get(QuizService);
  });

  it('returns a public question shape without scoring weights', async () => {
    const questions = await service.getQuestions('en');

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      id: 'q1',
      skill: 'speaking',
      category: 'self_assessment',
    });
    expect(questions[0].options[0]).toEqual({ id: 'low', text: 'Not yet' });
    expect(questions[0].options[0]).not.toHaveProperty('points');
  });

  it('uses the generic English self-assessment bank when a target-specific bank is absent', async () => {
    const questions = await service.getQuestions('ja');
    expect(questions).toHaveLength(2);
  });

  it('fails closed when question storage is unavailable', async () => {
    questionResults.set('en', { data: null, error: { message: 'secret db detail' } });
    await expect(service.getQuestions('en')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('scores option identifiers server-side and persists the authoritative CEFR level', async () => {
    const result = await service.submitResults('user-1', {
      targetLanguage: 'en',
      answers: { q1: 'high', q2: 'low' },
    });

    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(8);
    expect(result.percentage).toBe(63);
    expect(result.suggestedCefr).toBe('B2');
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('rejects missing questions instead of calculating a partial result', async () => {
    await expect(
      service.submitResults('user-1', {
        targetLanguage: 'en',
        answers: { q1: 'high' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects forged option identifiers', async () => {
    await expect(
      service.submitResults('user-1', {
        targetLanguage: 'en',
        answers: { q1: 'high', q2: '999-points' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not return success when proficiency persistence fails', async () => {
    updateEq.mockResolvedValue({ error: { message: 'write failed' } });

    await expect(
      service.submitResults('user-1', {
        targetLanguage: 'en',
        answers: { q1: 'high', q2: 'high' },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects malformed question configuration rather than trusting unsafe points', async () => {
    questionResults.set('en', {
      data: [
        {
          ...rows[0],
          options: [
            { id: 'bad', text: 'Bad', points: Number.POSITIVE_INFINITY },
            { id: 'ok', text: 'Okay', points: 1 },
          ],
        },
      ],
      error: null,
    });

    await expect(service.getQuestions('en')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
