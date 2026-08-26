import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import type { Mock } from 'vitest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LearningLessonsController } from './learning-lessons.controller';
import { LessonsService } from './lessons.service';

describe('LearningLessonsController', () => {
  let controller: LearningLessonsController;
  let service: { listLessons: Mock; getLesson: Mock };

  beforeEach(async () => {
    service = {
      listLessons: vi.fn().mockResolvedValue([{ id: 'lesson-1' }]),
      getLesson: vi.fn().mockResolvedValue({ id: 'lesson-1' }),
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

  it('fails closed when the auth guard supplies no user', async () => {
    await expect(controller.list(null)).rejects.toThrow(UnauthorizedException);
    await expect(controller.get(null, 'lesson-1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.listLessons).not.toHaveBeenCalled();
    expect(service.getLesson).not.toHaveBeenCalled();
  });
});
