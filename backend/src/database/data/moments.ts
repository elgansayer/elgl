import { randomUUID } from 'node:crypto';

/**
 * Local-development seed rows for the Moments social feed.
 *
 * Column names follow supabase/migrations/005_moments.sql (`user_id`,
 * `text_content`, `target_language`, ...). `moments-migration.contract.spec.ts`
 * keeps this builder and the migration in step so seeded data never silently
 * fails against the real schema.
 */

export interface SeedMomentParticipants {
  /** Posts the pinned Moment and the threaded reply. */
  hostId: string;
  /** Posts the correction comment that the host replies to. */
  partnerId: string;
  /** Users who like the Moment. The host is skipped and duplicates collapse. */
  likerIds: readonly string[];
}

export interface SeedMoment {
  id: string;
  user_id: string;
  text_content: string;
  media_urls: string[];
  media_type: 'images';
  target_language: string;
  post_type: 'moment';
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
}

export interface SeedMomentComment {
  id: string;
  moment_id: string;
  user_id: string;
  text_content: string;
  correction_payload: {
    original: string;
    corrected: string;
    explanation: string;
  } | null;
  parent_comment_id: string | null;
  reply_to_user_id: string | null;
}

export interface SeedMomentLike {
  moment_id: string;
  user_id: string;
}

export interface SeedMomentGraph {
  moment: SeedMoment;
  /** Ordered so a parent comment always precedes its replies. */
  comments: SeedMomentComment[];
  likes: SeedMomentLike[];
}

/**
 * Builds one pinned Moment with a correction comment, a threaded reply, and
 * likes. The denormalised `likes_count` and `comments_count` are derived from
 * the child rows so the seeded feed, the comment thread, and the "liked by"
 * list always agree.
 */
export function buildSeedMomentGraph(
  participants: SeedMomentParticipants,
): SeedMomentGraph {
  const { hostId, partnerId } = participants;
  const momentId = randomUUID();
  const correctionId = randomUUID();

  const comments: SeedMomentComment[] = [
    {
      id: correctionId,
      moment_id: momentId,
      user_id: partnerId,
      text_content:
        'In Japanese, we say 「継続は力なり」 (Keizoku wa chikara nari), which means "Continuation is power" or consistency is key!',
      correction_payload: {
        original: 'continuous learning',
        corrected: '継続は力なり (Keizoku wa chikara nari)',
        explanation: 'Standard Japanese proverb for continuous effort.',
      },
      parent_comment_id: null,
      reply_to_user_id: null,
    },
    {
      id: randomUUID(),
      moment_id: momentId,
      user_id: hostId,
      text_content:
        'Brilliant, thank you! Is it used more in speeches or in everyday conversation?',
      correction_payload: null,
      parent_comment_id: correctionId,
      reply_to_user_id: partnerId,
    },
  ];

  const likerIds = [...new Set(participants.likerIds)].filter(
    (userId) => userId !== hostId,
  );

  return {
    moment: {
      id: momentId,
      user_id: hostId,
      text_content:
        'Just arrived at the British Library in London! Exploring historical Japanese manuscripts today. Can anyone recommend a good idiom for "continuous learning" in Japanese?',
      media_urls: [
        'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600',
      ],
      media_type: 'images',
      target_language: 'en',
      post_type: 'moment',
      is_pinned: true,
      likes_count: likerIds.length,
      comments_count: comments.length,
    },
    comments,
    likes: likerIds.map((userId) => ({
      moment_id: momentId,
      user_id: userId,
    })),
  };
}

export interface SeedFlaggedMomentReport {
  reporter_id: string;
  reported_user_id: string;
  reported_moment_id: string;
  reported_moment_excerpt: string;
  reason_category: 'spam';
  description: string;
  status: 'pending';
}

/**
 * Builds one pending report that flags the seeded Moment, so the moderation
 * queue is populated in local development. Columns follow
 * supabase/migrations/20261109120000_moderation_flagged_moments_and_suspensions.sql.
 */
export function buildSeedFlaggedMomentReport(
  graph: SeedMomentGraph,
  reporterId: string,
): SeedFlaggedMomentReport {
  return {
    reporter_id: reporterId,
    reported_user_id: graph.moment.user_id,
    reported_moment_id: graph.moment.id,
    // Mirrors the 1000 character snapshot SafetyService takes when a Moment is flagged.
    reported_moment_excerpt: Array.from(graph.moment.text_content)
      .slice(0, 1000)
      .join(''),
    reason_category: 'spam',
    description:
      'Development seed: sample flagged Moment for the moderation queue.',
    status: 'pending',
  };
}
