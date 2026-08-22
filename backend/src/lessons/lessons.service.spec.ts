import { NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LessonsService } from './lessons.service';

function chain(overrides: Record<string, unknown> = {}) {
  const builder: Record<string, any> = {};
  for (const name of ['select', 'eq', 'neq', 'order', 'in', 'limit', 'single', 'maybeSingle']) {
    builder[name] = vi.fn().mockReturnValue(builder);
  }
  Object.assign(builder, overrides);
  return builder;
}

describe('LessonsService learner flows', () => {
  it('lists only learner-visible lessons and joins progress without N+1 queries', async () => {
    const userQuery = chain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { is_vip: false }, error: null }),
    });
    const lessonsQuery = chain({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'lesson-1',
            title: 'Greetings',
            language_code: 'ja',
            is_published: true,
            visibility: 'public',
            sort_order: 1,
          },
        ],
        error: null,
      }),
    });
    const progressQuery = chain({
      in: vi.fn().mockResolvedValue({
        data: [
          {
            lesson_id: 'lesson-1',
            progress_percent: 40,
            last_position: 2,
            completed_at: null,
          },
        ],
        error: null,
      }),
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'users') return userQuery;
        if (table === 'lessons') return lessonsQuery;
        if (table === 'lesson_progress') return progressQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const service = new LessonsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    const result = await service.listLearnerLessons('user-1', 'ja');

    expect(lessonsQuery.eq).toHaveBeenCalledWith('is_published', true);
    expect(lessonsQuery.neq).toHaveBeenCalledWith('visibility', 'hidden');
    expect(lessonsQuery.neq).toHaveBeenCalledWith('visibility', 'vip');
    expect(lessonsQuery.eq).toHaveBeenCalledWith('language_code', 'ja');
    expect(lessonsQuery.limit).toHaveBeenCalledWith(100);
    expect(progressQuery.in).toHaveBeenCalledWith('lesson_id', ['lesson-1']);
    expect(result[0]?.progress).toEqual({
      progress_percent: 40,
      last_position: 2,
      completed: false,
      completed_at: null,
    });
  });

  it('fails closed when an unavailable or hidden lesson is requested', async () => {
    const lessonsQuery = chain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const service = new LessonsService({
      getClient: () => ({ from: vi.fn().mockReturnValue(lessonsQuery) }),
    } as unknown as SupabaseService);

    await expect(service.getLearnerLesson('user-1', 'hidden-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('fails closed on VIP entitlement lookup errors', async () => {
    const userQuery = chain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'profile unavailable' },
      }),
    });
    const lessonsQuery = chain({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const client = {
      from: vi.fn((table: string) => (table === 'users' ? userQuery : lessonsQuery)),
    };
    const service = new LessonsService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await service.listLearnerLessons('user-1');

    expect(lessonsQuery.neq).toHaveBeenCalledWith('visibility', 'vip');
  });

  it('uses the atomic progress RPC and returns the persisted state', async () => {
    const progressQuery = chain({
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-1',
          lesson_id: 'lesson-1',
          progress_percent: 100,
          last_position: 4,
          completed_at: '2026-08-20T16:00:00.000Z',
        },
        error: null,
      }),
    });
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue(progressQuery),
    };
    const service = new LessonsService({
      getClient: () => client,
    } as unknown as SupabaseService);
    vi.spyOn(service, 'getLearnerLesson').mockResolvedValue({
      id: 'lesson-1',
      title: 'Greetings',
      language_code: 'ja',
      progress: {
        progress_percent: 50,
        last_position: 2,
        completed: false,
        completed_at: null,
      },
    });

    const result = await service.updateLearnerProgress('user-1', 'lesson-1', {
      progressPercent: 100,
      lastPosition: 4,
      completed: true,
    });

    expect(client.rpc).toHaveBeenCalledWith('upsert_lesson_progress', {
      p_user_id: 'user-1',
      p_lesson_id: 'lesson-1',
      p_progress_percent: 100,
      p_last_position: 4,
      p_complete: true,
    });
    expect(result).toEqual({
      progress_percent: 100,
      last_position: 4,
      completed: true,
      completed_at: '2026-08-20T16:00:00.000Z',
    });
  });
});
