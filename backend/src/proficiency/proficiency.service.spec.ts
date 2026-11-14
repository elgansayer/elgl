import { Test, TestingModule } from '@nestjs/testing';
import { ProficiencyService } from './proficiency.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { ProficiencyLevel } from './interfaces/proficiency.interface';

describe('ProficiencyService', () => {
  let service: ProficiencyService;
  let update: ReturnType<typeof vi.fn>;
  let eq: ReturnType<typeof vi.fn>;
  let awardXp: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    update = vi.fn();
    eq = vi.fn();
    awardXp = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProficiencyService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              from: vi.fn(() => ({
                update: (payload: unknown) => {
                  update(payload);
                  return { eq };
                },
              })),
            }),
          },
        },
        { provide: XpService, useValue: { awardXpForActivity: awardXp } },
      ],
    }).compile();

    service = module.get(ProficiencyService);
    eq.mockResolvedValue({ error: null });
  });

  it('maps the average assessment score to a CEFR level and persists it', async () => {
    const result = await service.assess(
      {
        userId: 'user-1',
        grammarScore: 70,
        vocabularyScore: 80,
        pronunciationScore: 90,
      },
      'user-1',
    );

    expect(result.level).toBe(ProficiencyLevel.C1);
    expect(result.overallScore).toBe(80);
    expect(update).toHaveBeenCalledWith({ proficiency_level: 'C1' });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(awardXp).toHaveBeenCalledWith('user-1', 'complete_assessment');
  });

  it('falls back to a mid score when no sub-score is supplied', async () => {
    const result = await service.assess({ userId: 'user-1' }, 'user-1');

    expect(result.overallScore).toBe(50);
    expect(result.level).toBe(ProficiencyLevel.B1);
    expect(result.grammarScore).toBe(0);
  });

  it('surfaces persistence failures instead of returning a level', async () => {
    eq.mockResolvedValue({ error: { message: 'unavailable' } });

    await expect(
      service.assess({ userId: 'user-1', grammarScore: 80 }, 'user-1'),
    ).rejects.toThrow('Failed to save proficiency level: unavailable');
    expect(awardXp).not.toHaveBeenCalled();
  });

  it('stores the selected native and target languages with levels', async () => {
    await service.setLanguages({
      userId: 'user-1',
      nativeLanguage: 'en',
      targetLanguages: [
        { language: 'es', level: ProficiencyLevel.B2 },
        { language: 'fr', level: ProficiencyLevel.A2 },
      ],
    });

    expect(update).toHaveBeenCalledWith({
      native_languages: ['en'],
      target_languages: ['es', 'fr'],
      language_levels: { es: ProficiencyLevel.B2, fr: ProficiencyLevel.A2 },
    });
  });
});
