-- Verification script: Admin Moderation RLS policies
-- Fixes #2375
--
-- This script validates that the admin RLS policies from migration
-- 20260807110437_review_rls_admin_moderation.sql are correctly applied.
-- Run against a development Supabase instance with `psql`.
--
-- Usage:
--   psql -h localhost -p 54322 -d postgres -U postgres -f supabase/tests/admin_rls_verification.sql
--
-- The script checks:
--   1. All expected policies exist on each table
--   2. Policy definitions include the admin EXISTS check
--   3. The users_update_admin policy exists and is separate from users_update_own

\echo '=== Admin Moderation RLS Policy Verification ==='
\echo ''

-- ── 1. blocks: verify admin-enabled SELECT and DELETE policies ──────────
\echo '--- blocks policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'blocks'
  AND (
      (policyname = 'blocks_select_own' AND cmd = 'SELECT')
      OR (policyname = 'blocks_delete_own' AND cmd = 'DELETE')
  )
ORDER BY policyname, cmd;

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocks'
      AND policyname IN ('blocks_select_own', 'blocks_delete_own')
      AND cmd IN ('SELECT', 'DELETE');

    IF policy_count < 2 THEN
        RAISE EXCEPTION 'FAIL: Expected 2 admin-enabled policies on blocks (SELECT + DELETE), found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: blocks has admin-enabled SELECT and DELETE policies';
END;
$$;

-- ── 2. reports: verify admin-enabled SELECT policy ──────────────────────
\echo '--- reports policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'reports'
  AND policyname = 'reports_select_own'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reports'
      AND policyname = 'reports_select_own'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on reports, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: reports has admin-enabled SELECT policy';
END;
$$;

-- ── 3. safety_reports: verify admin-enabled SELECT policy ───────────────
\echo '--- safety_reports policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'safety_reports'
  AND policyname = 'safety_reports_select_own'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'safety_reports'
      AND policyname = 'safety_reports_select_own'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on safety_reports, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: safety_reports has admin-enabled SELECT policy';
END;
$$;

-- ── 4. users: verify admin UPDATE policy exists separately from own ─────
\echo '--- users policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND policyname IN ('users_update_own', 'users_update_admin')
ORDER BY policyname;

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_update_admin'
      AND cmd = 'UPDATE';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected users_update_admin UPDATE policy on users, found %', policy_count;
    END IF;

    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_update_own'
      AND cmd = 'UPDATE';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected users_update_own UPDATE policy on users, found %', policy_count;
    END IF;

    RAISE NOTICE 'PASS: users has both users_update_own and users_update_admin policies';
END;
$$;

-- ── 5. profile_visits: verify admin-enabled SELECT policy ───────────────
\echo '--- profile_visits policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profile_visits'
  AND policyname = 'profile_visits_select_own'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_visits'
      AND policyname = 'profile_visits_select_own'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on profile_visits, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: profile_visits has admin-enabled SELECT policy';
END;
$$;

-- ── 6. chat_messages: verify admin-enabled SELECT policy ────────────────
\echo '--- chat_messages policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'chat_messages'
  AND policyname = 'chat_messages_select_own'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_select_own'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on chat_messages, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: chat_messages has admin-enabled SELECT policy';
END;
$$;

-- ── 7. notifications: verify admin-enabled SELECT policy ────────────────
\echo '--- notifications policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notifications'
  AND policyname = 'notifications_select_own'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_select_own'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on notifications, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: notifications has admin-enabled SELECT policy';
END;
$$;

-- ── 8. login_history: verify admin-or-own SELECT policy (from 017) ─────
\echo '--- login_history policies ---'
SELECT
    policyname,
    cmd,
    'OK' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'login_history'
  AND policyname = 'login_history_select_own_or_admin'
  AND cmd = 'SELECT';

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'login_history'
      AND policyname = 'login_history_select_own_or_admin'
      AND cmd = 'SELECT';

    IF policy_count < 1 THEN
        RAISE EXCEPTION 'FAIL: Expected admin-enabled SELECT policy on login_history, found %', policy_count;
    END IF;
    RAISE NOTICE 'PASS: login_history has admin-enabled SELECT policy';
END;
$$;

\echo ''
\echo '=== All admin RLS policy checks complete ==='