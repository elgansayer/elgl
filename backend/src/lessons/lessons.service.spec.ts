import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { LessonsService, type LessonRecord } from './lessons.service';

type MockResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

type QueryChainMock = {
  select: Mock;
  eq: Mock;
  order: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  upsert: Mock;
  single: Mock;
  maybeSingle: Mock;
  _setResolveData: (result: MockResult) => void;
  then: (resolve: (value: MockResult) => void) => undefined;
};

const createQueryChain = (): QueryChainMock => {
  const chain = {} as QueryChainMock;
  for (const method of [
    'select',
    'eq',
    'order',
    'insert',
    'update',
    'delete',
    'upsert',
    'single',
    'maybeSingle',
  ] as const) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  let result: MockResult = { data: null, error: null };
  chain._setResolveData = (next) => {
    result = next;
  };
  chain.then = (resolve) => {
    resolve(result);
    return undefined;
  };
  return chain;
};

const lesson: LessonRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Introductions',
  description: 'Practise introductions.',
  language_code: 'ja',
  content_json: {
    segments: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }],
  },
};

describe('LessonsService progress', () => {
  let service: LessonsService;
  let supabase: { from: Mock };

  beforeEach(async () => {
    supabase = { from: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(supabase) },
        },
      ],
    }).compile();

    service = module.get(LessonsService);
  });

  it('returns a zero progress record when the learner has never opened the lesson', async () => {
    const lessonQuery = createQueryChain();
    lessonQuery._setResolveData({ data: lesson, error: null });
    const progressQuery = createQueryChain();
    progressQuery._setResolveData({ data: null, error: null });
    supabase.from.mockImplementation((table: string) =>
      table === 'lessons' ? lessonQuery : progressQuery,
    );

    await expect(
      service.getLessonProgress('user-1', lesson.id),
    ).resolves.toEqual({
      lesson_id: lesson.id,
      segment_index: 0,
      completed: false,
      completed_at: null,
      updated_at: null,
    });
    expect(progressQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(progressQuery.eq).toHaveBeenCalledWith('lesson_id', lesson.id);
  });

  it('lists only progress rows scoped to the authenticated learner', async () => {
    const progressQuery = createQueryChain();
    progressQuery._setResolveData({
      data: [
        {
          lesson_id: lesson.id,
          segment_index: 1,
          completed: false,
          completed_at: null,
          updated_at: '2026-08-26T20:00:00.000Z',
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(progressQuery);

    await expect(service.listLessonProgress('user-1')).resolves.toEqual([
      {
        lesson_id: lesson.id,
        segment_index: 1,
        completed: false,
        completed_at: null,
        updated_at: '2026-08-26T20:00:00.000Z',
      },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('lesson_progress');
    expect(progressQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(progressQuery.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    });
  });

  it('upserts progress scoped to the authenticated learner', async () => {
    const lessonQuery = createQueryChain();
    lessonQuery._setResolveData({ data: lesson, error: null });
    const progressQuery = createQueryChain();
    progressQuery._setResolveData({
      data: {
        lesson_id: lesson.id,
        segment_index: 1,
        completed: false,
        completed_at: null,
        updated_at: '2026-08-26T20:00:00.000Z',
      },
      error: null,
    });
    supabase.from.mockImplementation((table: string) =>
      table === 'lessons' ? lessonQuery : progressQuery,
    );

    await expect(
      service.saveLessonProgress('user-1', lesson.id, 1, false),
    ).resolves.toMatchObject({ segment_index: 1, completed: false });
    expect(progressQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        lesson_id: lesson.id,
        segment_index: 1,
        completed: false,
      }),
      { onConflict: 'user_id,lesson_id' },
    );
  });

  it('rejects progress beyond the lesson content before writing', async () => {
    const lessonQuery = createQueryChain();
    lessonQuery._setResolveData({ data: lesson, error: null });
    const progressQuery = createQueryChain();
    supabase.from.mockImplementation((table: string) =>
      table === 'lessons' ? lessonQuery : progressQuery,
    );

    await expect(
      service.saveLessonProgress('user-1', lesson.id, 3, false),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(progressQuery.upsert).not.toHaveBeenCalled();
  });

  it('only accepts completion on the final readable segment', async () => {
    const lessonQuery = createQueryChain();
    lessonQuery._setResolveData({ data: lesson, error: null });
    const progressQuery = createQueryChain();
    supabase.from.mockImplementation((table: string) =>
      table === 'lessons' ? lessonQuery : progressQuery,
    );

    await expect(
      service.saveLessonProgress('user-1', lesson.id, 1, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(progressQuery.upsert).not.toHaveBeenCalled();
  });

  it('marks the final segment completed and returns the persisted row', async () => {
    const lessonQuery = createQueryChain();
    lessonQuery._setResolveData({ data: lesson, error: null });
    const progressQuery = createQueryChain();
    progressQuery._setResolveData({
      data: {
        lesson_id: lesson.id,
        segment_index: 2,
        completed: true,
        completed_at: '2026-08-26T20:01:00.000Z',
        updated_at: '2026-08-26T20:01:00.000Z',
      },
      error: null,
    });
    supabase.from.mockImplementation((table: string) =>
      table === 'lessons' ? lessonQuery : progressQuery,
    );

    await expect(
      service.saveLessonProgress('user-1', lesson.id, 2, true),
    ).resolves.toMatchObject({ segment_index: 2, completed: true });
  });
});
