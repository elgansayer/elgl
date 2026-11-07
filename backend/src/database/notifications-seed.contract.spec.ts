import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSeedNotifications } from './data/notifications';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/011_notifications_inbox.sql'),
  'utf8',
);
const seedSource = readFileSync(
  resolve(repositoryRoot, 'backend/src/database/seed.ts'),
  'utf8',
);

describe('notifications inbox seed data', () => {
  const now = new Date('2026-11-07T12:00:00.000Z');
  const options = {
    recipientId: 'recipient-1',
    actorIds: ['actor-1', 'actor-2', 'recipient-1'],
    momentId: 'moment-1',
    now,
  };

  it('only uses columns that exist on the notifications table', () => {
    const columns = new Set(
      buildSeedNotifications(options).flatMap((row) => Object.keys(row)),
    );

    for (const column of columns) {
      expect(migration).toContain(column);
    }
  });

  it('covers follows, likes, comments and system alerts newest first by recency', () => {
    const rows = buildSeedNotifications(options);

    expect(rows.map((row) => row.type).sort()).toEqual(
      [
        'comment_moment',
        'follow',
        'like_moment',
        'like_profile',
        'system',
      ].sort(),
    );
    expect(rows.filter((row) => !row.is_read).length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(new Date(row.created_at).getTime()).toBeLessThan(now.getTime());
    }
  });

  it('never attributes social activity to the recipient', () => {
    const social = buildSeedNotifications(options).filter(
      (row) => row.type !== 'system',
    );

    expect(social.length).toBeGreaterThan(0);
    expect(social.every((row) => row.actor_id !== 'recipient-1')).toBe(true);
  });

  it('attributes the system alert to the recipient with plain text', () => {
    const system = buildSeedNotifications(options).find(
      (row) => row.type === 'system',
    );

    expect(system).toMatchObject({
      recipient_id: 'recipient-1',
      actor_id: 'recipient-1',
      entity_id: null,
    });
    expect(system?.message).toBeTruthy();
  });

  it('points moment activity at the supplied moment and omits it otherwise', () => {
    const withMoment = buildSeedNotifications(options);
    const withoutMoment = buildSeedNotifications({
      ...options,
      momentId: undefined,
    });

    expect(
      withMoment
        .filter(
          (row) => row.type === 'like_moment' || row.type === 'comment_moment',
        )
        .every((row) => row.entity_id === 'moment-1'),
    ).toBe(true);
    expect(
      withoutMoment.some(
        (row) => row.type === 'like_moment' || row.type === 'comment_moment',
      ),
    ).toBe(false);
  });

  it('falls back to a lone system alert when there is nobody else to act', () => {
    const rows = buildSeedNotifications({
      recipientId: 'recipient-1',
      actorIds: ['recipient-1'],
      now,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('system');
  });

  it('is wired into the seeder without duplicating rows on re-runs', () => {
    expect(seedSource).toContain('seedNotifications(supabase)');
    expect(seedSource).toContain('Notifications already seeded');
  });
});
