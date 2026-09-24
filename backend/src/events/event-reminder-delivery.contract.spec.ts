import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const service = readFileSync(
  resolve(repositoryRoot, 'backend/src/events/events.service.ts'),
  'utf8',
);
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260823104500_harden_event_reminder_delivery.sql',
  ),
  'utf8',
);

describe('event reminder push delivery contract', () => {
  it('scans immediately on startup and every minute afterwards', () => {
    expect(service).toMatch(/void this\.checkReminders\(\);/);
    expect(service).toMatch(
      /setInterval\(\(\) => void this\.checkReminders\(\), 60_000\)/,
    );
  });

  it('creates reminders only for attending users in the 15-minute window', () => {
    expect(migration).toMatch(/r\.status = 'attending'/i);
    expect(migration).toMatch(/e\.is_cancelled = false/i);
    expect(migration).toMatch(/e\.date_time > p_now/i);
    expect(migration).toMatch(
      /e\.date_time <= p_now \+ INTERVAL '15 minutes'/i,
    );
    expect(migration).toMatch(/ON CONFLICT \(event_id, user_id\) DO NOTHING/i);
  });

  it('leases bounded reminder work safely across backend replicas', () => {
    expect(migration).toMatch(/FOR UPDATE OF ers SKIP LOCKED/i);
    expect(migration).toMatch(/LIMIT v_limit/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_due_event_reminders[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_due_event_reminders[\s\S]*TO service_role/i,
    );
    expect(service).toMatch(/const REMINDER_BATCH_SIZE = 200;/);
    expect(service).toMatch(/const REMINDER_SEND_CONCURRENCY = 25;/);
  });

  it('dispatches a deep-linkable event reminder through the shared push service', () => {
    expect(service).toMatch(/sendPushNotification\([\s\S]*claim\.user_id/);
    expect(service).toMatch(/type: 'event_reminder'/);
    expect(service).toMatch(/category: 'groups'/);
    expect(service).toMatch(/starts in \$\{minutesUntilStart\}/);
    expect(service).toMatch(/route: `\/events\/\$\{claim\.event_id\}`/);
    expect(service).toMatch(/startsAt: claim\.event_date_time/);
  });

  it('marks successful deliveries sent and releases failures for retry', () => {
    expect(service).toMatch(/Promise\.allSettled/);
    expect(service).toMatch(/const REMINDER_RETRY_DELAY_MS = 60_000;/);
    expect(service).toMatch(/status: 'sent'/);
    expect(service).toMatch(/next_attempt_at: new Date/);
    expect(service).toMatch(/claimed_at: null/);
  });
});
