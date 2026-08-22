import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LearnerLessonsController } from './learner-lessons.controller';
import { LessonsService } from './lessons.service';

describe('LearnerLessonsController', () => {
  const lessonsService = {
    listLearnerLessons: vi.fn(),
    getLearnerLesson: vi.fn(),
    updateLearnerProgress: vi.fn(),
  } as unknown as LessonsService;

  const controller = new LearnerLessonsController(lessonsService);
  const request = { user: { id: 'user-1' } };

  afterEach(() => vi.clearAllMocks());

  it('is protected by SupabaseAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', LearnerLessonsController) as unknown[];
    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('lists lessons for the authenticated user with an optional language filter', async () => {
    vi.mocked(lessonsService.listLearnerLessons).mockResolvedValue([]);

    await controller.list(request, { language: 'ja' });

    expect(lessonsService.listLearnerLessons).toHaveBeenCalledWith('user-1', 'ja');
  });

  it('loads a lesson for the authenticated user', async () => {
    vi.mocked(lessonsService.getLearnerLesson).mockResolvedValue({
      id: 'lesson-1',
      title: 'Greetings',
      language_code: 'ja',
      progress: {
        progress_percent: 0,
        last_position: 0,
        completed: false,
        completed_at: null,
      },
    });

    await controller.get(request, 'lesson-1');

    expect(lessonsService.getLearnerLesson).toHaveBeenCalledWith('user-1', 'lesson-1');
  });

  it('updates progress only for the authenticated user', async () => {
    const update = { progressPercent: 50, lastPosition: 2 };
    vi.mocked(lessonsService.updateLearnerProgress).mockResolvedValue({
      progress_percent: 50,
      last_position: 2,
      completed: false,
      completed_at: null,
    });

    await controller.updateProgress(request, 'lesson-1', update);

    expect(lessonsService.updateLearnerProgress).toHaveBeenCalledWith(
      'user-1',
      'lesson-1',
      update,
    );
  });
});
