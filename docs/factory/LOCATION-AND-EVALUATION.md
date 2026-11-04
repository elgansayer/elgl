# Factory ownership and framework evaluation

Source inventory and research decision: 4 November 2026. Source inspection does not
establish the installed VPS revision, process liveness or subscription health.

## Where the factory lives

The shared Python package is named `repo-factory`; its import name remains
`openhands_factory`. Its canonical source currently lives in `elgansayer/elgl`.

| Component | Current location |
| --- | --- |
| Shared scheduler, jobs, routing, leases and supervision | `elgl/automation/openhands_factory/` |
| Shared unit and actual namespace tests | `elgl/automation/tests/` and `automation/runtime_checks/` |
| Provider policy and project instance templates | `elgl/config/factory/` |
| Host units, updater and deployment scripts | `elgl/config/systemd/`, `scripts/` and `setup-debian.sh` |
| Dashboard | `elgl/factory-dashboard/` |
| Saturn intake, trusted preparation and reference verification | `Neptune-Bomberman/tools/factory/` |
| Saturn research tools and experiment evidence | `Neptune-Bomberman/tools/saturn_lab/` and `docs/restart/` |
| Workout | Target project of the shared control package; its application repository is not the canonical factory source |

The neutral systemd template is `config/systemd/repo-factory@.service`.
The committed updater names the `hellotalk` and `workout-agent` instances, while
`config/factory/instances/neptune.env` is a disabled preparatory template. Inspect
actual unit/configuration and installed package hashes before describing deployment.
The repository folder name, Python package name and host instance name differ.

## A dedicated repository

A dedicated `repo-factory` repository is a useful destination for shared ownership,
releases and cross-project tests. Prepare migration after the current bounded work
is preserved and deployment compatibility is demonstrated. There is no new
repository or source migration in this change.

An extraction must preserve package/import compatibility and relevant Git history,
then update trusted source pins, updater materialisation, systemd scripts, prompt
paths and CI together. Keep project-specific gameplay/reference checks in their
project repositories. Broker/state identities, credentials, active leases, unfinished
worktrees and private research evidence remain stable across the source move.
Require a dry-run deployment, an existing bounded research job, interruption/recovery
and a rollback receipt before changing the live canonical source.

## Framework candidates

These are capability-based recommendations, not measured Saturn performance claims.

| Candidate | Useful capability | Next decision |
| --- | --- | --- |
| OpenCode | Provider-selectable coding CLI, sessions and programmatic interface | Trial one low-cost worker through the existing adapter |
| OpenHands SDK | Existing programmable agent/tool integration, persistence and isolated execution | Reuse the accepted integration and evaluate specific upstream improvements |
| LangGraph / Deep Agents | Checkpointed workflows, persistent context and bounded subagent delegation | Test only against a demonstrated handoff/context/recovery gap |
| Pi | Extensible coding harness already represented by a Factory adapter | Evaluate the installed path before introducing another equivalent worker |
| Aider | Architect/editor separation for focused code edits | Watch or benchmark one small editing task if correction cost is a bottleneck |
| NVIDIA OpenShell | Policy-controlled execution and credential/network boundaries | Evaluate as a sandbox component against actual host requirements and overhead |

OpenShell is an execution/runtime candidate; adopting it does not implement shared
research ownership, dependency handoffs or code-recovery acceptance by itself.
Any framework's child agents must be visible to the same shared accounting.

Compare candidates on identical source-pinned tasks: an independently specified
decoder/harness change, a known code-semantic question and an interrupted result
handoff. Measure accepted original-byte results, correction effort, repeated work,
tool failures, model/token usage, wall time and peak host resources. Preserve exact
reference checks. A higher agent count or vendor benchmark alone is insufficient.

The requested review runs weekly on Monday mornings. Each report should identify a
material change, official dated sources and a bounded adopt/test/watch experiment.
It must not install tools, purchase plans, migrate source or start new provider jobs.
Neptune's original-code recovery remains the primary programme.

## Primary sources

- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [OpenCode Go](https://opencode.ai/docs/go/)
- [OpenHands SDK](https://docs.openhands.dev/sdk)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview)
- [Pi source](https://github.com/badlogic/pi-mono)
- [Aider modes](https://aider.chat/docs/usage/modes.html)
- [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell)
