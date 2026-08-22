import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { QuizController } from './quiz.controller';
import type { QuizService } from './quiz.service';

describe('QuizController', () => {
  const quizService = {
    getQuestions: vi.fn(),
    submitResults: vi.fn(),
  };
  const controller = new QuizController(
    quizService as unknown as QuizService,
  );

  beforeEach(() => vi.clearAllMocks());

  it('requires the Supabase authentication guard for the diagnostic surface', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, QuizController) as unknown[];
    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('defaults an omitted question language to English', () => {
    controller.getQuestions({ language: '' });
    expect(quizService.getQuestions).toHaveBeenCalledWith('en');
  });

  it('forwards the authenticated user id and opaque answers', () => {
    const user = { id: 'user-1' } as User;
    const body = {
      targetLanguage: 'ja',
      answers: { q1: 'answer-a' },
    };

    controller.submitResults(user, body);
    expect(quizService.submitResults).toHaveBeenCalledWith('user-1', body);
  });

  it('fails closed if the auth context contains no user', () => {
    expect(() =>
      controller.submitResults(null, {
        targetLanguage: 'ja',
        answers: { q1: 'answer-a' },
      }),
    ).toThrow(UnauthorizedException);
    expect(quizService.submitResults).not.toHaveBeenCalled();
  });
});
