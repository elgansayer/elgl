import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { PracticeProgressService } from './practice-progress.service';
import { VerbConjugationController } from './verb-conjugation.controller';
import type { VerbConjugationService } from './verb-conjugation.service';

describe('VerbConjugationController', () => {
  const session = {
    languageCode: 'es',
    languageName: 'Spanish',
    tense: 'present' as const,
    exercises: [],
  };

  function createController() {
    const service = {
      listLanguages: vi.fn().mockReturnValue([
        {
          code: 'es',
          name: 'Spanish',
          tenses: ['present', 'past'],
          verbCount: 5,
        },
      ]),
      getSession: vi.fn().mockReturnValue(session),
      checkAnswer: vi.fn().mockReturnValue({
        correct: true,
        expected: 'hablo',
        submitted: 'hablo',
        languageCode: 'es',
      }),
    } as unknown as VerbConjugationService;
    const progress = {
      recordAttempt: vi.fn().mockResolvedValue(undefined),
      summarise: vi.fn().mockResolvedValue({
        total: 3,
        correct: 2,
        accuracy: 67,
        byLanguage: [{ languageCode: 'es', total: 3, correct: 2 }],
      }),
    } as unknown as PracticeProgressService;

    return {
      controller: new VerbConjugationController(service, progress),
      service,
      progress,
    };
  }

  it('requires the Supabase authentication guard', () => {
    const guards: unknown[] = Reflect.getMetadata(
      GUARDS_METADATA,
      VerbConjugationController,
    );

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('lists languages and builds sessions from validated query values', () => {
    const { controller, service } = createController();

    expect(controller.listLanguages()).toHaveLength(1);
    expect(
      controller.getSession({ language: 'fr', tense: 'past', limit: 3 }),
    ).toBe(session);
    expect(service.getSession).toHaveBeenCalledWith('fr', 'past', 3);
  });

  it('records a graded attempt for the authenticated learner', async () => {
    const { controller, progress } = createController();

    const result = await controller.submitAttempt({ id: 'user-1' } as User, {
      exerciseId: 'verb:es:hablar:present:0',
      answer: 'hablo',
    });

    expect(result.correct).toBe(true);
    expect(progress.recordAttempt).toHaveBeenCalledWith({
      userId: 'user-1',
      module: 'verb_conjugation',
      itemId: 'verb:es:hablar:present:0',
      languageCode: 'es',
      submittedAnswer: 'hablo',
      correct: true,
    });
  });

  it('fails closed without an authenticated learner', async () => {
    const { controller, service, progress } = createController();

    await expect(
      controller.submitAttempt(null, {
        exerciseId: 'verb:es:hablar:present:0',
        answer: 'hablo',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getProgress(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.checkAnswer).not.toHaveBeenCalled();
    expect(progress.recordAttempt).not.toHaveBeenCalled();
  });

  it('returns the learner progress summary', async () => {
    const { controller, progress } = createController();

    await expect(
      controller.getProgress({ id: 'user-1' } as User),
    ).resolves.toEqual({
      total: 3,
      correct: 2,
      accuracy: 67,
      byLanguage: [{ languageCode: 'es', total: 3, correct: 2 }],
    });
    expect(progress.summarise).toHaveBeenCalledWith(
      'user-1',
      'verb_conjugation',
    );
  });
});
