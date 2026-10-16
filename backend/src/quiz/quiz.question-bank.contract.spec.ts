import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QuizService } from './quiz.service';

type QueryResult = {
  data: unknown;
  error: unknown;
};

const englishQuestion = {
  id: 'question-en-1',
  question_text: 'Choose the best answer.',
  language: 'en',
  options: [
    { id: 'option-a', text: 'Answer A', points: 1 },
    { id: 'option-b', text: 'Answer B', points: 4 },
  ],
  skill_area: 'grammar',
  category: 'multiple_choice',
  difficulty_level: 2,
};

function createService(results: Record<string, QueryResult>) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${columns}`);
          return {
            eq(column: string, language: string) {
              calls.push(`eq:${column}:${language}`);
              return {
                order(orderColumn: string, options: { ascending: boolean }) {
                  calls.push(
                    `order:${orderColumn}:${String(options.ascending)}`,
                  );
                  return {
                    limit(count: number) {
                      calls.push(`limit:${count}`);
                      return Promise.resolve(
                        results[language] ?? { data: [], error: null },
                      );
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const service = new QuizService({
    getClient: () => client,
  } as unknown as SupabaseService);

  return { service, calls };
}

describe('Diagnostic question bank contract', () => {
  it('reads a bounded, difficulty-ordered multiple-choice bank from Supabase', async () => {
    const japaneseQuestion = {
      ...englishQuestion,
      id: 'question-ja-1',
      question_text: 'もっとも自然な答えを選んでください。',
      language: 'ja',
    };
    const { service, calls } = createService({
      ja: { data: [japaneseQuestion], error: null },
    });

    const questions = await service.getQuestions('ja');

    expect(calls).toEqual([
      'from:assessment_questions',
      'select:id, question_text, language, options, skill_area, category, difficulty_level',
      'eq:language:ja',
      'order:difficulty_level:true',
      'limit:20',
    ]);
    expect(questions).toEqual([
      {
        id: 'question-ja-1',
        text: 'もっとも自然な答えを選んでください。',
        skill: 'grammar',
        category: 'multiple_choice',
        options: [
          { id: 'option-a', text: 'Answer A' },
          { id: 'option-b', text: 'Answer B' },
        ],
      },
    ]);
    expect(questions[0].options[0]).not.toHaveProperty('points');
  });

  it('falls back to the English bank only when the requested language has no rows', async () => {
    const { service, calls } = createService({
      ja: { data: [], error: null },
      en: { data: [englishQuestion], error: null },
    });

    const questions = await service.getQuestions('ja');

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('question-en-1');
    expect(
      calls.filter((call) => call === 'from:assessment_questions'),
    ).toHaveLength(2);
    expect(calls).toContain('eq:language:ja');
    expect(calls).toContain('eq:language:en');
  });

  it('returns an honest empty result when the English bank is empty', async () => {
    const { service, calls } = createService({
      en: { data: [], error: null },
    });

    await expect(service.getQuestions('en')).resolves.toEqual([]);
    expect(calls.filter((call) => call === 'eq:language:en')).toHaveLength(1);
  });

  it('fails closed on storage errors instead of fabricating fallback questions', async () => {
    const { service, calls } = createService({
      ja: { data: null, error: { message: 'database unavailable' } },
      en: { data: [englishQuestion], error: null },
    });

    await expect(service.getQuestions('ja')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(calls).toContain('eq:language:ja');
    expect(calls).not.toContain('eq:language:en');
  });
});
