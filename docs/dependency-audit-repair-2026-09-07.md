# npm audit baseline repair — 2026-09-07

The scheduled repository dependency audit failed on `main` at `a935d15ca0a345875d853e269d5aa333dd6b9291` with HIGH-severity findings in the root, backend, frontend, admin-portal and load-test lockfiles.

The repair refreshes normal, non-breaking lockfile resolutions for the root, frontend, admin portal and load-test workspaces. This resolves the `nanoid` advisory in the root/load-test graph and the fixable frontend/admin tooling advisories without changing the audit policy.

The backend failure was different: `ngrok` was present only as a development-only local tunnel script and pulled the vulnerable `extract-zip` chain covered by `GHSA-jmr9-qjv8-65gv`. The repository's dependency disposition register already classified `ngrok` as investigate/move-or-remove, and repository search found no application or CI consumer. The obsolete tunnel script and `ngrok` dev dependency were therefore removed instead of forcing a vulnerable or breaking version.

Validation uses the repository's strict baseline command, `npm audit --audit-level=high`, for root, backend, frontend, admin-portal, e2e and `tests/load`. No audit severity, job, or security gate is skipped or weakened.
