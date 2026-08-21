import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendedUserResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the recommended user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiPropertyOptional({
    description: "The user's display name",
    example: 'MariaLopez',
  })
  displayName?: string | null;

  @ApiPropertyOptional({
    description: "URL of the user's avatar image",
    example: 'https://r2.hellotalk.example.com/avatars/maria.jpg',
  })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    description: "ISO 639-1 code of the user's native language",
    example: 'es',
  })
  nativeLanguage?: string | null;

  @ApiPropertyOptional({
    description: 'Array of ISO 639-1 codes the user is learning',
    example: ['en', 'fr'],
  })
  targetLanguages?: string[] | null;

  @ApiProperty({
    description:
      'Number of shared interest tags between the requesting user and this recommended user',
    example: 5,
    minimum: 0,
  })
  sharedInterests!: number;

  @ApiPropertyOptional({
    description: 'Whether the user has enabled serious learner mode',
    example: true,
  })
  isSeriousLearner?: boolean | null;

  @ApiPropertyOptional({
    description: 'Consecutive days the user has maintained a study streak',
    example: 42,
    minimum: 0,
  })
  studyStreakDays?: number | null;

  @ApiPropertyOptional({
    description:
      'Ratio of corrections the user has provided versus received (0.0-1.0). Higher values indicate a more helpful community member.',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  correctionRatio?: number | null;

  @ApiPropertyOptional({
    description:
      'Indicates which fallback tier produced this recommendation. Present only when returned by getRecommendationsWithFallback.',
    enum: ['interest', 'language_exchange', 'active_users', 'mock'],
    example: 'interest',
  })
  matchTier?: 'interest' | 'language_exchange' | 'active_users' | 'mock';
}
