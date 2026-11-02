import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261102000000_atomic_audio_room_tips.sql',
);

describe('atomic audio-room tip migration (#1812)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('adds a retry-safe sender-scoped idempotency boundary', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_key UUID/i);
    expect(sql).toMatch(
      /ON public\.audio_room_tips \(sender_user_id, idempotency_key\)[\s\S]*?WHERE idempotency_key IS NOT NULL/i,
    );
    expect(sql).toMatch(/tip idempotency key is required/i);
    expect(sql).toMatch(/tip idempotency subject mismatch/i);
    expect(sql.indexOf('IF FOUND THEN')).toBeLessThan(
      sql.indexOf('IF NOT v_room.is_active THEN'),
    );
  });

  it('locks both wallets before changing balances and recording the tip', () => {
    const lockPosition = sql.indexOf('ORDER BY u.id');
    const senderUpdatePosition = sql.indexOf(
      'SET coins_balance = v_sender_balance - p_amount',
    );
    const receiverUpdatePosition = sql.indexOf(
      'SET coins_balance = v_receiver_balance + p_amount',
    );
    const insertPosition = sql.indexOf('INSERT INTO public.audio_room_tips');

    expect(lockPosition).toBeGreaterThanOrEqual(0);
    expect(sql.slice(lockPosition, senderUpdatePosition)).toMatch(/FOR UPDATE/);
    expect(senderUpdatePosition).toBeLessThan(receiverUpdatePosition);
    expect(receiverUpdatePosition).toBeLessThan(insertPosition);
  });

  it('keeps the money-moving RPC unavailable to browser roles', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.transfer_audio_room_tip\(UUID, UUID, INTEGER, UUID\)[\s\S]*?FROM PUBLIC, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.transfer_audio_room_tip\(UUID, UUID, INTEGER, UUID\)[\s\S]*?TO service_role/i,
    );
  });

  it('prevents browser roles from reading or mutating tip audit rows', () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS audio_room_tips_select_own ON public\.audio_room_tips/i,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Users can view own tips" ON public\.audio_room_tips/i,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS audio_room_tips_insert_own ON public\.audio_room_tips/i,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS audio_room_tips_delete_own ON public\.audio_room_tips/i,
    );
    expect(sql).toMatch(
      /REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public\.audio_room_tips[\s\S]*?FROM PUBLIC, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.audio_room_tips[\s\S]*?TO service_role/i,
    );
  });
});
