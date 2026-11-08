/**
 * Local-development seed rows for the unified notifications inbox.
 *
 * Column names follow supabase/migrations/011_notifications_inbox.sql.
 * `notifications.actor_id` is a required foreign key, so system alerts (which
 * have no human actor) are attributed to the recipient's own row, exactly as
 * NotificationsService.createNotification stores them.
 */

export type SeedNotificationType =
  'follow' | 'like_profile' | 'like_moment' | 'comment_moment' | 'system';

export interface SeedNotification {
  recipient_id: string;
  actor_id: string;
  type: SeedNotificationType;
  entity_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SeedNotificationOptions {
  recipientId: string;
  /** Users who performed the activity. Reused in order when there are few. */
  actorIds: readonly string[];
  /** Moment that the like and comment rows point at, when one exists. */
  momentId?: string;
  /** Anchor for the relative timestamps; defaults to the current time. */
  now?: Date;
}

const MINUTE_MS = 60_000;

export function buildSeedNotifications(
  options: SeedNotificationOptions,
): SeedNotification[] {
  const { recipientId, momentId, now = new Date() } = options;
  const actorIds = options.actorIds.filter((id) => id !== recipientId);
  const minutesAgo = (minutes: number): string =>
    new Date(now.getTime() - minutes * MINUTE_MS).toISOString();

  const systemAlert: SeedNotification = {
    recipient_id: recipientId,
    actor_id: recipientId,
    type: 'system',
    entity_id: null,
    message: 'Welcome to HelloTalk! Your notifications area is ready.',
    is_read: false,
    created_at: minutesAgo(15),
  };

  if (actorIds.length === 0) return [systemAlert];

  const social = (
    index: number,
    type: SeedNotificationType,
    createdMinutesAgo: number,
    isRead: boolean,
    extra: Pick<SeedNotification, 'entity_id' | 'message'> = {
      entity_id: null,
      message: null,
    },
  ): SeedNotification => ({
    recipient_id: recipientId,
    actor_id: actorIds[index % actorIds.length],
    type,
    ...extra,
    is_read: isRead,
    created_at: minutesAgo(createdMinutesAgo),
  });

  const rows = [
    social(0, 'follow', 5, false),
    social(1, 'like_profile', 30, false),
  ];

  if (momentId) {
    rows.push(
      social(2, 'comment_moment', 120, true, {
        entity_id: momentId,
        message: 'Great pronunciation in your voice clip!',
      }),
      social(3, 'like_moment', 300, true, {
        entity_id: momentId,
        message: null,
      }),
    );
  }

  return [...rows, systemAlert];
}
