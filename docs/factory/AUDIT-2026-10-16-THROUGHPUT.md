# Factory throughput audit - 16 October 2026

## Finding

The Factory was live and making progress, but it was not draining the backlog at a useful rate. At inspection time it had 513 open pull requests, 2,466 discovered issues, 138 backed-off jobs and two active jobs. The secondary Factory disk was 87 percent full. One pull request had merged during the inspection, proving that the control plane was operating rather than deadlocked.

The principal throughput constraints were:

1. Every merge waited for a complete push CI run on the resulting intermediate `main` SHA before the next merge could start, even though the active `CI / required` ruleset is non-strict.
2. A reviewed PR that became `BEHIND` after another merge was updated, rebuilt, reverified and rereviewed. With hundreds of open PRs this creates a replay loop in which each merge invalidates work on the next candidates.
3. Any application change ran backend, frontend and admin checks, regardless of which workspace changed.
4. Database and governance runners started for changes they could not observe.
5. The 8 GiB host admitted only two lightweight provider sessions even though heavy frontend verification already uses an exclusive host gate.

## Changes

- Keep exact-head `CI / required`, `factory/independent-review`, human review vetoes, mergeability checks, serial merge execution and `--match-head-commit`.
- Permit an already-reviewed and CI-green `BEHIND` head to merge when GitHub still reports it mergeable. Newly discovered stale heads are still updated before verification and review.
- Make the extra current-main push-CI fence configurable and disable it for HelloTalk's non-strict required-check policy. Only one Factory merge may remain in flight.
- Cancel superseded `main` push CI runs so the newest integrated state receives the full post-merge suite.
- Classify backend, frontend, admin, governance, database and Factory impact separately. Pull requests run only the affected workspace suites. Pushes and merge-group candidates continue to run the full suite, and unknown or empty diffs still fail open to every group.
- Raise HelloTalk to four control-plane workers, three host agent slots and three review lanes. Heavy verification remains exclusive, and the service retains its 6 GiB hard memory cap.
- Raise the hourly route/review budgets from 48/36 to 72/60 so the additional host and Google capacity is usable while retaining bounded subscription spend.
- Reduce the external-head settling window from 120 seconds to 30 seconds. A later commit still invalidates review evidence and must be rereviewed, so this changes wasted-review risk rather than merge safety.
- Refresh the Google route to the account-visible Gemini 3.8 Flash effort tiers.
- Enable the installed Pi adapter as a bounded fourth subscription provider after its GitHub Copilot OAuth probe returned `ready`.

## Deliberate non-change

## Follow-up: storage, stale heads and rollout cadence

A live follow-up found both instances paused at the 5 GiB storage reserve. Removing
14 reproducible dependency caches from inactive worktrees restored 11.4 GiB free
and scheduling resumed. Source files and provider credentials were preserved.

GitHub's `BLOCKED` and `UNSTABLE` aggregate states can hide a stale base. Initial
verification and unverified-head refresh now inspect local ancestry for those
states as well as `UNKNOWN`, then use the existing SHA-matched branch update and
fresh CI/review flow. This avoids retrying failures already fixed on main, such
as Google Fonts downloads inside the networkless verifier. Reviewed merge
candidates retain the non-strict fast merge policy.

Both updater timers now check every 30 minutes with up to two minutes of jitter,
instead of waiting until the following 03:00 UTC. The updater still skips package
installation and restarts when current, and drains active workers before rollout.

Validation: full Factory pytest suite, Ruff formatting/lint and mypy for the
pipeline change; six regression cases cover three aggregate states through both
initial intake and existing-head refresh. Systemd validates the timer calendar.

## Independent review

The independent review gate remains. It was not the dominant delay, and removing it would discard useful cross-provider defect detection. The improvement instead removes redundant base replay and post-merge waiting while increasing review concurrency.

The open-PR WIP limit also remains. It correctly prevents new issue admission while the repository has 513 open PRs; the Factory should converge and close existing work before authoring more branches.
