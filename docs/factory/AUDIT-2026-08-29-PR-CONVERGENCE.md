# Factory PR convergence payload audit - 2026-08-29

## Finding

The Factory performs a PR-convergence search before creating implementation work and again before creating a pull request. The first search does not yet have a local changed-path fingerprint, but it still requested the `files` field for every open or recent pull request.

At this audit snapshot the repository has 2,453 total pull requests and 185 open pull requests. Changed-file data cannot contribute a `changed-path-fingerprint` match until `known_path_fingerprint` exists, and changed-path evidence is not a strong canonical identity signal by itself.

## Change

`find_equivalent_pull_requests()` now requests pull-request file arrays only when `known_path_fingerprint` is available. The initial pre-work search retains issue links, logical task identity, branch metadata and explicit supersession links without asking GitHub to materialize thousands of changed-file arrays. The later pre-PR convergence search still requests files and preserves exact changed-path-fingerprint matching.

This removes data that is provably unused on the first scan rather than weakening duplicate detection.

## Quality and autonomy floor

No provider routing, reasoning tier, retry policy, task ownership, verification, security review, quality repair, independent review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability or branch-protection behavior changes.

The Factory remains fully autonomous. Persistent failures remain on machine-owned retry/backoff paths and no quarantine or human-triage workflow is introduced.

## Scope coordination

Open PR #8728 already owns backlog refresh cadence, production provider circuit policy and Codex bounded-phase effort. This change intentionally does not duplicate those edits. It addresses the separate payload cost inside each logical task's PR-convergence scan.
