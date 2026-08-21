import { ApiProperty } from '@nestjs/swagger';

/**
 * Standardised Discovery Profile DTO.
 *
 * Represents the response shape for Discovery Map endpoints.
 * Used by Swagger/OpenAPI to generate accurate response schemas
 * for partner search, audio intros, spotlight, and language pair results.
 */
export class DiscoveryProfileDto {
  @ApiProperty({
    description: 'Unique user identifier (UUID v4)',
    example: 'd7e1a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
  })
  id!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'Yuki',
  })
  display_name!: string;

  @ApiProperty({
    description: 'Native language ISO codes in order of proficiency',
    example: ['ja'],
    type: [String],
  })
  native_languages!: string[];

  @ApiProperty({
    description: 'Target language ISO codes the user is learning',
    example: ['en', 'ko'],
    type: [String],
  })
  target_languages!: string[];

  @ApiProperty({
    description: 'User biography text',
    example: 'Hello! I am studying English. Let us practice together!',
    nullable: true,
  })
  bio_text?: string | null;

  @ApiProperty({
    description: 'Avatar image URL (Cloudflare R2)',
    example: 'https://r2.example.com/avatars/user-d7e1.jpg',
    nullable: true,
  })
  avatar_url?: string | null;

  @ApiProperty({
    description: 'Audio introduction recording URL (Cloudflare R2)',
    example: 'https://r2.example.com/audio-intros/user-d7e1.mp3',
    nullable: true,
  })
  audio_intro_url?: string | null;

  @ApiProperty({
    description: 'VIP subscription status (8 UKP / $10 USD per month)',
    example: false,
  })
  is_vip!: boolean;

  @ApiProperty({
    description: 'Consecutive study streak days',
    example: 42,
  })
  study_streak_days!: number;

  @ApiProperty({
    description: 'Ratio of corrections contributed to received (0.0-1.0)',
    example: 0.85,
  })
  correction_ratio!: number;

  @ApiProperty({
    description:
      'Serious learner status (auto-calculated: streak > 7 AND correction ratio >= 0.8)',
    example: true,
  })
  is_serious_learner!: boolean;

  @ApiProperty({
    description: 'Partner of the Week flag (set weekly via cron)',
    example: false,
  })
  is_partner_of_week?: boolean;

  @ApiProperty({
    description:
      'Distance in metres from search coordinates (geospatial searches only)',
    example: 3241.5,
    nullable: true,
  })
  distance_metres?: number | null;

  @ApiProperty({
    description:
      'Self-assessed proficiency level (e.g. Beginner, Intermediate, Advanced)',
    example: 'Intermediate',
    nullable: true,
  })
  proficiency_level?: string | null;

  @ApiProperty({
    description: 'User age',
    example: 25,
    nullable: true,
  })
  age?: number | null;

  @ApiProperty({
    description: 'User gender',
    example: 'Female',
    nullable: true,
  })
  gender?: string | null;

  @ApiProperty({
    description: 'Country name',
    example: 'Japan',
    nullable: true,
  })
  country?: string | null;

  @ApiProperty({
    description: 'City name',
    example: 'Tokyo',
    nullable: true,
  })
  city?: string | null;

  @ApiProperty({
    description: 'User interests',
    example: ['music', 'photography', 'travel'],
    type: [String],
    nullable: true,
  })
  interests?: string[] | null;

  @ApiProperty({
    description: 'Learning goals',
    example: ['fluency', 'conversation'],
    type: [String],
    nullable: true,
  })
  learning_goals?: string[] | null;

  @ApiProperty({
    description: 'ISO timestamp of profile creation',
    example: '2025-01-15T08:30:00.000Z',
  })
  created_at!: string;

  @ApiProperty({
    description: 'ISO timestamp of last activity',
    example: '2026-08-07T10:30:00.000Z',
    nullable: true,
  })
  last_active_at?: string | null;
}
