# Factory efficiency audit: exact external PR deduplication

Date: 2026-09-12

## Finding

The Factory already has strong task-claim, logical-title, branch, issue-link, changed-path, provider-budget, retry, review-admission, and reviewed-SHA protections. Those controls prevent most duplicate Factory-owned work, but they cannot reliably stop an external provider from opening a second pull request with different metadata for code that is already present in another open external pull request.

Recent repository history showed this gap can consume implementation/review allowance and GitHub Actions runs before a duplicate is recognized. Semantic similarity is not safe enough for an autonomous closer because two legitimate changes can touch the same files or have similar titles.

## Change

`exact_duplicate_pr_guard.py` adds a deliberately strict, model-free admission guard for external pull requests:

- it considers only open, non-draft, same-repository PRs targeting `main` that the Factory itself could review;
- it excludes `factory/*` branches and existing skip/supersession labels, matching the Factory's ownership boundary;
- it compares the complete Git tree OID at each PR head, not titles, path overlap, embeddings, or an LLM judgement;
- only PRs whose complete repository trees are byte-identical are grouped as duplicates;
- an already `factory-reviewed` PR is retained to preserve completed independent-review spend, otherwise the oldest PR is canonical;
- both heads are re-read immediately before closure so a synchronize race fails open;
- the redundant PR is closed and marked `factory-skip`; the canonical PR remains subject to every normal Factory and GitHub gate.

The existing Branch PR Hygiene workflow runs the guard immediately on relevant pull-request events. Its existing daily schedule also scans all open PRs, providing autonomous recovery if an event run is interrupted. GitHub CLI operations retry transient failures locally. The event path uses a sparse checkout and no dependency install, so the guard itself is substantially cheaper than a provider review or repair cycle.

## Deliberate non-goals

The guard does **not** close merely similar PRs. It intentionally does not infer semantic equivalence from titles, issue text, changed-path sets, patches with different resulting trees, or model output. Those broader heuristics could suppress valid engineering work and would violate the quality floor.

It also does not alter model routing, provider failover, security review, local verification, independent review, review-provider separation, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability, or branch-protection requirements.

## Autonomy and failure handling

There is no quarantine, manual-triage, or human-release state. An exact duplicate is safely superseded by an equivalent canonical PR. A transient GitHub failure is retried by the guard; if an event execution still fails, the existing daily hygiene schedule retries the full open-PR scan. A PR whose head changes during the race check is left open and will be reconsidered from fresh state on a later event or scheduled scan.

No merge is performed by this guard, and no red or missing required check is bypassed.
