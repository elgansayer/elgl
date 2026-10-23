-- Issue #9563: persist the Serious Learner mode preference.
--
-- users.serious_learner_mode is read and written by the frontend
-- (SeriousLearnerModeService), UsersService and discovery
-- (docs/serious-learner-mode.md, #7634), but no migration created it, so a
-- database built from this corpus could not save the preference.
-- ADD COLUMN IF NOT EXISTS keeps this safe where the column was added by hand.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS serious_learner_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.serious_learner_mode IS
  'Opt-in focused discovery preference. Distinct from is_serious_learner, which is an earned qualification and must never be used as this preference.';
