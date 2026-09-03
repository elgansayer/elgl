# Factory efficiency audit: invalid-output backoff and provider-config delivery

Date: 2026-09-02, refreshed against current `main` on 2026-09-03

## Findings

The current production router opens provider circuits on the first classified provider-side failure and performs no immediate same-provider retry. That is the right allowance policy, but one configured failure class was not receiving a useful durable backoff.

`invalid_output_cooldown_seconds` was 60 seconds while both production Factory instances use `FACTORY_COOLDOWN_SECONDS=300`. A provider that returned malformed or otherwise unusable agent output therefore left its circuit before the next ordinary five-minute control-plane refresh. In practice, the first-failure circuit could protect the current route while providing no protection at the next normal scheduling pass.

This is materially different from a task-side verification failure. Invalid agent output means the provider process started and consumed subscription capacity, but did not return a result the Factory can safely use. Repeatedly rediscovering that condition is pure allowance waste.

The deeper deployment audit found a second problem: the production services do not read `config/factory/agents.production.json` directly. Both repository-scoped instances use the root-owned external `FACTORY_AGENTS_CONFIG=/etc/repo-factory/agents.json`, while the legacy service uses `/etc/hellotalk-factory/agents.json`. The autonomous updater refreshed the repository, Python package, worker image, and root-owned runtime scripts, but did not reconcile that external provider configuration. As a result, a reviewed routing, cooldown, model-tier, or provider-policy improvement could be merged into `main` yet remain unapplied on the host until a separate installer/deployment refreshed `/etc`.

The neutral multi-repository updater also executes `/opt/repo-factory/repo-factory-update.sh`, while the historical updater only refreshed its legacy `/opt/hellotalk-factory/hellotalk-factory-update.sh` copy. That created a bootstrap gap for fixes to the updater itself.

## Changes

Production `invalid_output_cooldown_seconds` is now 900 seconds.

With the existing five-minute production refresh cadence, a failed provider remains ineligible for at least two subsequent normal refreshes and becomes eligible for an autonomous half-open probe after fifteen minutes. The route can still fail over immediately to another healthy configured subscription provider, and the failed provider recovers automatically after the bounded cooldown.

The updater now reconciles the provider config from the exact verified Git commit after refreshing the Factory package and before restarting services. The destination is canonicalised and restricted to the approved `/etc/repo-factory/` or `/etc/hellotalk-factory/` roots, its parent and file access metadata are repaired to the production root/Factory-user contract, and the installed JSON is validated with the newly installed `AgentsConfig` schema. Content, ownership, or mode drift therefore causes an autonomous reconciliation instead of being treated as current.

If config contents change, the prior bytes are retained until the restart succeeds. Any later failure restores and validates those previous bytes before either Factory service is restarted. A failed or unconfirmed rollback refuses the automatic restart instead of silently proceeding with an unknown provider configuration.

Future runtime-bundle refreshes update both the legacy and neutral root-owned updater/watchdog paths. For existing hosts whose neutral updater predates this change, the verified root-owned storage-maintenance path performs a bounded one-time bootstrap: it copies the legacy updater only after that source contains the reviewed reconciliation marker and only when both source and neutral runtime root satisfy strict root-owned, non-symlink metadata checks. Once the neutral updater contains the marker, normal immutable-Git-blob refresh owns future updates.

## Efficiency impact

The previous 60-second invalid-output cooldown skipped zero ordinary five-minute scheduling refreshes. The 900-second value spans three refresh intervals, preventing the same malformed-output provider from being rediscovered on the next two normal passes while preserving automatic recovery and healthy-provider failover.

Provider-policy changes now reach the live external configuration through the normal autonomous update path. This removes a class of silent configuration drift where Factory code could claim a lower-cost routing/backoff policy while the running services continued consuming allowance under older settings.

No token or monetary percentage is invented because the subscription CLIs do not expose a portable, authoritative allowance counter. Existing Factory metrics record calls, success/failure classifications, fallbacks, rate limits, quota/auth failures, durations, capacity waits, and known API cost; prompt/output-size proxies remain a useful future observability improvement.

## Audit scope

The surrounding Factory controls were rechecked before making this change:

- production already uses zero immediate same-provider retries;
- the first provider-side failure opens the circuit;
- provider failover remains bounded and machine-driven;
- planning, architecture and implementation retain their stronger reasoning tiers, while bounded review and repair phases use cheaper models/effort where already proven safe;
- OpenHands PAYG remains disabled in production;
- prompt construction remains bounded and later phases receive smaller task bodies than implementation;
- issue admission, provider-start budgets and review-start budgets remain bounded;
- provider starts are charged at the actual process-start boundary rather than for control-plane-only routing attempts;
- duplicate/convergence scans retain strong issue, logical-task, branch and supersession identity checks;
- deterministic verification, security review, independent review, reviewed-SHA protection and required GitHub checks remain unchanged;
- chronic task failures continue through autonomous durable backoff rather than requiring a person.

No additional model downgrade, concurrency reduction, retry removal, CI bypass or merge-policy weakening was high-confidence enough to combine with this correction.

## Autonomy and safety

This change introduces no quarantine, manual-triage or operator-release state. A malformed-output provider is temporarily removed from routing, another healthy provider can be tried under the existing route budget, and the failed provider becomes eligible again automatically after the cooldown.

Provider configuration remains root-owned and is never sourced by executing content from the Factory-user-writable checkout. The updater identifies the exact commit, resolves the config blob from Git object storage, verifies its blob identity, installs atomically into an approved canonical destination, validates the schema, and retains rollback bytes until both services have restarted successfully.

No task failure is hidden or converted into success. The same verification, security review, independent review, exact reviewed SHA, `factory/independent-review`, `CI / required`, mergeability and branch-protection requirements remain authoritative.

## Regression coverage

`automation/tests/test_factory_efficiency_2026_09_02_invalid_output.py` reads both production instance profiles and asserts that the invalid-output cooldown covers at least three configured Factory refresh intervals, avoiding a duplicated hard-coded cadence assumption.

`automation/tests/test_factory_efficiency_2026_09_03_provider_config_deploy.py` locks the deployment trust boundary, rejects a `..` escape from an approved config root, executes the exact rollback/restart functions in a fake service harness to prove both services observe the previous config bytes, proves a failed rollback prevents service restart, and locks the neutral updater bootstrap path used by the active systemd unit.

Existing update/storage contract tests and workflow shellcheck continue to cover bounded Git/network operations, root-owned runtime materialisation, fail-closed heartbeat handling, and storage-maintenance safety.

GitHub Actions on the pull-request head are the authoritative clean-environment validation for Ruff format/lint, mypy, the complete Factory pytest suite, workflow/shell contracts, governance and the canonical required gate.
