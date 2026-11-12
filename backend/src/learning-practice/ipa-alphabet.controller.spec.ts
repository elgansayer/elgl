import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IpaAlphabetController } from './ipa-alphabet.controller';
import type { IpaAlphabetService } from './ipa-alphabet.service';
import type { PracticeProgressService } from './practice-progress.service';

describe('IpaAlphabetController', () => {
  const catalogue = {
    languageCode: 'en',
    languageName: 'English',
    phonemes: [],
  };
  const quiz = { languageCode: 'en', languageName: 'English', questions: [] };

  function createController() {
    const service = {
      listLanguages: vi
        .fn()
        .mockReturnValue([{ code: 'en', name: 'English', phonemeCount: 44 }]),
      getCatalogue: vi.fn().mockReturnValue(catalogue),
      getQuiz: vi.fn().mockReturnValue(quiz),
      checkAnswer: vi.fn().mockReturnValue({
        correct: false,
        expected: 'see',
        submitted: 'cat',
        languageCode: 'en',
      }),
    } as unknown as IpaAlphabetService;
    const progress = {
      recordAttempt: vi.fn().mockResolvedValue(undefined),
      summarise: vi.fn().mockResolvedValue({
        total: 1,
        correct: 0,
        accuracy: 0,
        byLanguage: [{ languageCode: 'en', total: 1, correct: 0 }],
      }),
    } as unknown as PracticeProgressService;

    return {
      controller: new IpaAlphabetController(service, progress),
      service,
      progress,
    };
  }

  it('requires the Supabase authentication guard', () => {
    const guards: unknown[] = Reflect.getMetadata(
      GUARDS_METADATA,
      IpaAlphabetController,
    );

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('serves the catalogue and quiz for the requested language', () => {
    const { controller, service } = createController();

    expect(controller.listLanguages()).toHaveLength(1);
    expect(controller.getCatalogue({ language: 'en' })).toBe(catalogue);
    expect(controller.getQuiz({ language: 'en', limit: 4 })).toBe(quiz);
    expect(service.getQuiz).toHaveBeenCalledWith('en', 4);
  });

  it('records a graded attempt for the authenticated learner', async () => {
    const { controller, progress } = createController();

    const result = await controller.submitAttempt({ id: 'user-1' } as User, {
      exerciseId: 'ipa:en:i-long',
      answer: 'cat',
    });

    expect(result.correct).toBe(false);
    expect(progress.recordAttempt).toHaveBeenCalledWith({
      userId: 'user-1',
      module: 'ipa_alphabet',
      itemId: 'ipa:en:i-long',
      languageCode: 'en',
      submittedAnswer: 'cat',
      correct: false,
    });
  });

  it('fails closed without an authenticated learner', async () => {
    const { controller, progress } = createController();

    await expect(
      controller.submitAttempt(null, {
        exerciseId: 'ipa:en:i-long',
        answer: 'see',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getProgress(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(progress.recordAttempt).not.toHaveBeenCalled();
  });

  it('returns the learner progress summary', async () => {
    const { controller, progress } = createController();

    await expect(
      controller.getProgress({ id: 'user-1' } as User),
    ).resolves.toEqual({
      total: 1,
      correct: 0,
      accuracy: 0,
      byLanguage: [{ languageCode: 'en', total: 1, correct: 0 }],
    });
    expect(progress.summarise).toHaveBeenCalledWith('user-1', 'ipa_alphabet');
  });
});
