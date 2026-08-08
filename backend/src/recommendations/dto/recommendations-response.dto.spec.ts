import { RecommendedUserResponseDto } from './recommendations-response.dto';

describe('RecommendedUserResponseDto', () => {
  it('should create a valid DTO instance', () => {
    const dto = new RecommendedUserResponseDto();
    dto.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    dto.displayName = 'TestUser';
    dto.sharedInterests = 5;
    dto.isSeriousLearner = true;
    dto.studyStreakDays = 10;
    dto.correctionRatio = 0.85;
    dto.matchTier = 'interest';

    expect(dto.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(dto.displayName).toBe('TestUser');
    expect(dto.sharedInterests).toBe(5);
    expect(dto.isSeriousLearner).toBe(true);
    expect(dto.studyStreakDays).toBe(10);
    expect(dto.correctionRatio).toBe(0.85);
    expect(dto.matchTier).toBe('interest');
  });

  it('should accept null for optional fields', () => {
    const dto = new RecommendedUserResponseDto();
    dto.id = 'a';
    dto.sharedInterests = 0;
    dto.displayName = null;
    dto.avatarUrl = null;
    dto.nativeLanguage = null;
    dto.targetLanguages = null;
    dto.isSeriousLearner = null;
    dto.studyStreakDays = null;
    dto.correctionRatio = null;

    expect(dto.id).toBe('a');
    expect(dto.displayName).toBeNull();
    expect(dto.targetLanguages).toBeNull();
  });

  it('should accept all four matchTier values', () => {
    const tiers = [
      'interest',
      'language_exchange',
      'active_users',
      'mock',
    ] as const;
    for (const tier of tiers) {
      const dto = new RecommendedUserResponseDto();
      dto.id = 'a';
      dto.sharedInterests = 0;
      dto.matchTier = tier;
      expect(dto.matchTier).toBe(tier);
    }
  });
});
