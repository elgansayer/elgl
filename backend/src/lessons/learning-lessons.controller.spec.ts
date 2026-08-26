import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import type { Mock } from 'vitest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LearningLessonsController } from './learning-lessons.controller';
import { LessonsService } from './lessons.service';

describe('LearningLessonsController', () => {
  let controller: LearningLessonsController;
  let service: {
    listLessons: Mock;
    getLesson: Mock;
    getLessonProgress: Mock;
    saveLessonProgress: Mock;
  };

  beforeEach(async () => {
    service = {
      listLessons: vi.fn().mockResolvedValue([{ id: 'lesson-1' }]),
      getLesson: vi.fn().mockResolvedValue({ id: 'lesson-1' }),
      getLessonProgress: vi.fn().mockResolvedValue({
        lesson_id: 'lesson-1',
        segment_index: 1,
        completed: false,
        completed_at: null,
        updated_at: '2026-08-26T20:00:00.000Z',
      }),
      saveLessonProgress: vi.fn().mockResolvedValue({
        lesson_id: 'lesson-1',
        segment_index: 2,
        completed: true,
        completed_at: '2026-08-26T20:01:00.000Z',
        updated_at: '2026-08-26T20:01:00.000Z',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LearningLessonsController],
      providers: [{ provide: LessonsService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(LearningLessonsController);
  });

  it('lists lessons for an authenticated learner', async () => {
    const user = { id: 'user-1' } as User;

    await expect(controller.list(user)).resolves.toEqual([{ id: 'lesson-1' }]);
    expect(service.listLessons).toHaveBeenCalledOnce();
  });

  it('loads one lesson for an authenticated learner', async () => {
    const user = { id: 'user-1' } as User;

    await expect(controller.get(user, 'lesson-1')).resolves.toEqual({
      id: 'lesson-1',
    });
    expect(service.getLesson).toHaveBeenCalledWith('lesson-1');
  });

  it('loads progress only for the authenticated user', async () => {
    const user = { id: 'user-1' } as User;

    await expect(controller.getProgress(user, 'lesson-1')).resolves.toMatchObject({
      segment_index: 1,
      completed: false,
    });
    expect(service.getLessonProgress).toHaveBeenCalledWith('user-1', 'lesson-1');
  });

  it('persists bounded progress for the authenticated user', async () => {
    const user = { id: 'user-1' } as User;

    await expect(
      controller.saveProgress(user, 'lesson-1', {
        segment_index: 2,
        completed: true,
      }),
    ).resolves.toMatchObject({ segment_index: 2, completed: true });
    expect(service.saveLessonProgress).toHaveBeenCalledWith(
      'user-1',
      'lesson-1',
      2,
      true,
    );
  });

  it('fails closed when the auth guard supplies no user', async () => {
    await expect(controller.list(null)).rejects.toThrow(UnauthorizedException);
    await expect(controller.get(null, 'lesson-1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.getProgress(null, 'lesson-1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      controller.saveProgress(null, 'lesson-1', {
        segment_index: 0,
        completed: false,
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(service.listLessons).not.toHaveBeenCalled();
    expect(service.getLesson).not.toHaveBeenCalled();
    expect(service.getLessonProgress).not.toHaveBeenCalled();
    expect(service.saveLessonProgress).not.toHaveBeenCalled();
  });
});
