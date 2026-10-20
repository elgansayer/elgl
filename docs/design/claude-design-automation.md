# Claude Design automation

Status: operational. Implements the automated parts of `docs/claude-design-two-way-sync.md`.

## What runs and where

| Job                  | Where                                                    | When                                            | What it does                                                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage gate        | CI (`constitution` job, `npm run check:design-coverage`) | every PR touching the frontend                  | Fails when any runtime surface (component, page, Helm control, nested feature folder) has no design-sync item, a preview is unmapped, or a feature catalogue lacks a specimen for a mapped surface.                                                                                                               |
| Design System Health | GitHub Actions (`design-system-health.yml`)              | PRs touching previews/tokens; Mondays 05:17 UTC | Static audit: runtime token contrast in both themes, preview token drift against `styles.scss`, physical CSS, raw colours, required-state evidence. PRs fail only on new token contrast regressions (ratchet). Weekly run files de-duplicated `design-improvement` + `factory-ready` issues.                      |
| Nightly sync         | Factory host cron (`run-automation.sh sync`)             | 02:30 UTC                                       | Headless Claude Code with the host's claude.ai login: three-way compares repository previews, the last-synced baseline, and Claude Design; pushes code-first changes, pulls design-first changes into previews, and opens issues for conflicts. Commits manifest/state updates as an auto-merge PR.               |
| Weekly improvement   | Factory host cron (`run-automation.sh improve`)          | Mondays 04:00 UTC                               | Static + rendered audit (Playwright: 390px overflow, tap targets, computed contrast, light/dark × LTR/RTL screenshots), then a critique of three rotating design-sync items. Preview-only improvements land as auto-merge `design-first` PRs; runtime fixes become `factory-ready` issues the Factory implements. |

Install or refresh the cron entries with `scripts/design-sync/install-automation.sh`. Logs live in
`~/.cache/hellotalk-design-automation/logs/` (30-day retention). Every run uses a fresh detached
worktree of `origin/main`, so no shared checkout is ever reset or cleaned.

## The sync loop

```
repository preview ──┐                        ┌── Claude Design file
                     ├─ plan-sync.mjs ────────┤
design-sync.state.json (last pushed hash) ────┘
        │
        ├─ local changed, remote = baseline  → push   (write_files)
        ├─ remote changed, local = baseline  → pull   (preview updated + "Design-first change" issue)
        ├─ both changed / no baseline        → conflict (both versions saved + "Design sync conflict" issue)
        └─ identical                         → in sync
```

`design-sync.state.json` records the hash of the content last written to Claude Design per path. For
artefacts reconciled before automation existed, the baseline falls back to the preview at the item's
`lastReconciledCommit`. Conflicts are never auto-resolved; the issue carries the contract's priority
rules and the Factory reconciles them through a normal PR.

## Authorisation

Claude Design is reached through Claude Code's DesignSync tool, which uses the claude.ai login of the
host user. When that login lacks design-system access the nightly run opens a single
`Claude Design sync blocked: authorization required` issue (label `needs-human`). Fix it once by running
`/design-login` in Claude Code on the factory host; the next run pushes everything pending and closes
the issue. No credentials are stored in the repository.

## Feature catalogue previews

`frontend/design-preview/features/*.html` and `components/primitives/helm-controls.html` are built from
`scripts/design-sync/feature-preview.template.html`. Each mapped surface is one
`<section class="specimen" data-component="<path under frontend/src/app>">` showing its real states.
When adding a component: add its path to the right `feature.*` item's `repositoryPaths` and add a specimen
to that item's preview, or the coverage gate fails.

## Commands

```bash
npm run check:design-coverage     # unit tests + coverage gate
npm run audit:design              # static audit → reports/design-audit.{json,md}
npm run audit:design-render       # rendered audit + screenshots → reports/design-render-audit.json, reports/design-screens/
scripts/design-sync/run-automation.sh sync|improve   # run a job now
```
