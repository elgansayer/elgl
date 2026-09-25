# Serious Learner discovery policy

Issue #812 standardises the existing Serious Learner filter instead of adding a second discovery path.

## Canonical qualification

A candidate is an **active Serious Learner** only when both conditions are true:

1. `study_streak_days >= 7` (inclusive); and
2. `last_active_at >= now - 24 hours`.

`correction_ratio` is deliberately not part of this predicate. Correction/helpfulness remains a ranking signal in features such as Partner of the Week, but a learner does not have to correct other users to qualify as a serious learner.

`users.is_serious_learner` is a **preference/mode flag for the searching user**. It enables the Serious Learner filter automatically; it is not trusted as candidate qualification. This distinction prevents a stale or self-declared flag from bypassing activity requirements.

The current streak subsystem updates `last_active_at` when it updates `study_streak_days`, and the streak reset job uses the same activity field. Until a dedicated `last_study_at` field is introduced, the 24-hour window is therefore the canonical freshness boundary and is enforced at query time as well as by the daily reset job.

## Where the rule is enforced

- ordinary `/discovery` partner queries;
- PostGIS `search_nearby_users` queries;
- audio-introduction discovery;
- mock/degraded discovery filtering, which fails closed when freshness is unknown;
- Partner of the Week candidate freshness, while its separate correction/helpfulness ranking still applies.

Collection queries remain bounded (`50` in normal discovery and `100` in the spatial RPC). Existing blocked-user, hidden-from-search and deletion-pending boundaries remain in force.

## Frontend state and failure behaviour

The discovery screen already exposes a Serious filter pill and a persistent Serious Learner Mode preference. The persistent mutation now:

- disables duplicate toggles while the profile write is pending;
- exposes a screen-reader status while saving and an alert on failure;
- changes local mode/filter state only after persistence succeeds;
- removes the Serious filter when the persistent mode is disabled;
- preserves the persisted mode when temporary discovery filters are reset;
- composes the persisted mode with filters such as Nearby rather than silently bypassing it.

A failed profile write leaves the prior state intact and can be retried by using the same toggle again. No private profile content, coordinates or tokens are logged.

## Rollout

1. Apply `20260820223000_serious_learner_active_streak_policy.sql` so the spatial RPC has the canonical predicate.
2. Deploy the backend so non-spatial, audio-intro and Partner of the Week paths use the shared policy.
3. Deploy the frontend mutation-state changes.

No user data backfill is required. Existing `study_streak_days` and `last_active_at` values are used directly.

## Rollback

Revert the application commits together. If the backend is rolled back to a version that expects the previous spatial `is_serious_learner` predicate, restore the prior `search_nearby_users` function body as part of the rollback to avoid mixed semantics. The additive partial index may remain safely in place.
