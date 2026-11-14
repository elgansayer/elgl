import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { ProficiencyController } from './proficiency.controller';
import { ProficiencyService } from './proficiency.service';
import { ProficiencyLevel } from './interfaces/proficiency.interface';

describe('ProficiencyController', () => {
  const user = { id: 'user-1' } as unknown as User;
  const assessment = {
    level: ProficiencyLevel.B1,
    overallScore: 55,
    grammarScore: 55,
    vocabularyScore: 0,
    pronunciationScore: 0,
    testedAt: '2026-11-14T00:00:00.000Z',
  };
  const service = {
    assess: vi.fn().mockResolvedValue(assessment),
    setLanguages: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new ProficiencyController(
    service as unknown as ProficiencyService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated assessment', async () => {
    await expect(
      controller.assess(null, { userId: 'user-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.assess).not.toHaveBeenCalled();
  });

  it('assesses the authenticated user', async () => {
    await expect(
      controller.assess(user, { userId: 'spoofed', grammarScore: 60 }),
    ).resolves.toEqual(assessment);
    expect(service.assess).toHaveBeenCalledWith(
      { userId: 'spoofed', grammarScore: 60 },
      'user-1',
    );
  });

  it('overrides the body user id with the authenticated session', async () => {
    await expect(
      controller.setLanguages(user, {
        userId: 'spoofed',
        nativeLanguage: 'en',
        targetLanguages: [{ language: 'es', level: ProficiencyLevel.B1 }],
      }),
    ).resolves.toEqual({ success: true });
    expect(service.setLanguages).toHaveBeenCalledWith({
      userId: 'user-1',
      nativeLanguage: 'en',
      targetLanguages: [{ language: 'es', level: ProficiencyLevel.B1 }],
    });
  });

  it('rejects unauthenticated language updates', async () => {
    await expect(
      controller.setLanguages(null, {
        userId: 'user-1',
        nativeLanguage: 'en',
        targetLanguages: [],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
