"""Factory operator command line interface."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import TYPE_CHECKING

from openhands_factory.alerts import AlertService
from openhands_factory.authentication import authenticate_openai
from openhands_factory.config import FactoryConfig
from openhands_factory.control_panel import (
    FactoryControlPanel,
    build_status_snapshot,
    render_status_markdown,
)
from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient
from openhands_factory.jobs import JobStore
from openhands_factory.legacy_runtime import detect_legacy_runtime
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import JobState
from openhands_factory.oauth_health import smoke_openai_subscription
from openhands_factory.process_security import protect_process_credentials
from openhands_factory.provider_profiles import discover_gemini_models, discover_opencode_models
from openhands_factory.state import read_json
from openhands_factory.task_source import TaskStore

if TYPE_CHECKING:
    from openhands_factory.doctor import Check


def run_doctor(config: FactoryConfig, *, online: bool) -> list[Check]:
    from openhands_factory.doctor import run_doctor as implementation

    return implementation(config, online=online)


def agent_provider_checks(config: FactoryConfig) -> list[Check]:
    from openhands_factory.doctor import agent_provider_checks as implementation

    return implementation(config)


def github_repository_access_check(config: FactoryConfig) -> Check:
    from openhands_factory.doctor import github_repository_access_check as implementation

    return implementation(config)


def github_merge_policy_check(config: FactoryConfig) -> Check:
    from openhands_factory.doctor import github_merge_policy_check as implementation

    return implementation(config)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="hellotalk-factory")
    subcommands = result.add_subparsers(dest="command", required=True)
    doctor = subcommands.add_parser("doctor")
    doctor.add_argument("--online", action="store_true")
    auth = subcommands.add_parser("auth")
    auth.add_argument("provider", choices=("openai",))
    auth.add_argument("--force", action="store_true")
    models = subcommands.add_parser("models")
    models.add_argument("provider", choices=("opencode-go", "gemini"))
    providers = subcommands.add_parser("providers")
    providers.add_argument("action", choices=("check",))
    legacy = subcommands.add_parser("legacy")
    legacy.add_argument("action", choices=("scan",))
    task = subcommands.add_parser("task")
    task.add_argument("action", choices=("run",))
    task.add_argument("--issue", type=int)
    task.add_argument("--dry-run", action="store_true")
    subcommands.add_parser("daemon")
    subcommands.add_parser("status")
    subcommands.add_parser("pause")
    subcommands.add_parser("resume")
    subcommands.add_parser("metrics")
    dashboard = subcommands.add_parser("dashboard")
    dashboard.add_argument("action", choices=("show", "sync"))
    dashboard.add_argument("--force", action="store_true")
    subcommands.add_parser("reconcile")
    subcommands.add_parser("alert-daemon-failed")
    backlog = subcommands.add_parser("backlog")
    backlog.add_argument("action", choices=("requeue-quarantined",))
    backlog.add_argument("--issue", type=int, action="append")
    backlog.add_argument("--announce", action="store_true")
    return result


def _config() -> FactoryConfig:
    config = FactoryConfig.from_environment()
    # Keep parsed secrets only in typed configuration. Provider children receive
    # an explicit allowlisted environment, and unrelated verification commands do
    # not need daemon, vendor API, or application credentials.
    sensitive_suffixes = ("_API_KEY", "_TOKEN", "_SECRET", "_PASSWORD")
    for name in tuple(os.environ):
        if name.upper().endswith(sensitive_suffixes):
            os.environ.pop(name, None)
    return config


def _legacy_checks() -> list[Check]:
    from openhands_factory.doctor import Check

    findings = detect_legacy_runtime()
    if not findings:
        return [Check("legacy-runtime", True, "no retired swarm runtime artifacts detected")]
    active = [finding for finding in findings if finding.active]
    detail = "; ".join(
        f"{finding.kind}:{finding.identifier} ({finding.detail})" for finding in findings
    )
    return [
        Check(
            "legacy-runtime",
            not active,
            detail,
            warning=not active,
        )
    ]


def _doctor_checks(config: FactoryConfig, *, online: bool) -> list[Check]:
    from openhands_factory.doctor import Check

    checks = run_doctor(config, online=online)
    checks.extend(_legacy_checks())
    if online:
        oauth = smoke_openai_subscription(config)
        checks.append(
            Check(
                "openai-subscription-online",
                True,
                "optional OpenHands SDK OAuth, separate from Codex CLI: "
                f"{oauth.kind}: {oauth.detail}",
                warning=not oauth.passed,
            )
        )
    return checks


def _provider_startup_checks(config: FactoryConfig) -> list[Check]:
    """Return the bounded read-only gates required before daemon activation."""

    from openhands_factory.doctor import Check

    checks = agent_provider_checks(config)
    checks.extend(_legacy_checks())
    checks.append(github_repository_access_check(config))
    checks.append(github_merge_policy_check(config))
    oauth = smoke_openai_subscription(config)
    checks.append(
        Check(
            "openai-subscription-online",
            True,
            f"optional OpenHands SDK OAuth, separate from Codex CLI: {oauth.kind}: {oauth.detail}",
            warning=not oauth.passed,
        )
    )
    return checks


def main(arguments: list[str] | None = None) -> int:
    args = parser().parse_args(arguments)
    try:
        protect_process_credentials()
        config = _config()
        if args.command == "doctor":
            checks = _doctor_checks(config, online=args.online)
            for check in checks:
                status = "FAIL" if not check.passed else "WARN" if check.warning else "PASS"
                print(f"{status} {check.name}: {check.detail}")
            return 0 if all(check.passed for check in checks) else 1
        if args.command == "auth":
            authenticate_openai(config, force=args.force)
            return 0
        if args.command == "models":
            models = (
                discover_opencode_models(config)
                if args.provider == "opencode-go"
                else discover_gemini_models(config)
            )
            print("\n".join(sorted(models)))
            return 0
        if args.command == "providers":
            checks = _provider_startup_checks(config)
            for check in checks:
                status = "FAIL" if not check.passed else "WARN" if check.warning else "PASS"
                print(f"{status} {check.name}: {check.detail}")
            return 0 if all(check.passed for check in checks) else 1
        if args.command == "legacy":
            findings = detect_legacy_runtime()
            print(
                json.dumps(
                    [
                        {
                            "kind": finding.kind,
                            "identifier": finding.identifier,
                            "active": finding.active,
                            "detail": finding.detail,
                        }
                        for finding in findings
                    ],
                    indent=2,
                )
            )
            return 1 if any(finding.active for finding in findings) else 0
        if args.command == "task":
            if not args.dry_run:
                print(
                    "Refusing direct task execution until doctor and isolation gates pass",
                    file=sys.stderr,
                )
                return 2
            print(
                json.dumps(
                    {"dry_run": True, "issue": args.issue, "llm_contacted": False, "mutated": False}
                )
            )
            return 0
        if args.command == "daemon":
            from openhands_factory.daemon import FactoryDaemon

            return FactoryDaemon(config).run()
        if args.command in {"pause", "resume"}:
            from openhands_factory.daemon import set_paused

            set_paused(config, args.command == "pause")
            print(f"Factory {args.command}d")
            return 0
        if args.command == "status":
            print(
                json.dumps(
                    read_json(config.state_dir / "daemon.json", {"status": "unknown"}), indent=2
                )
            )
            return 0
        if args.command == "metrics":
            from openhands_factory.pr_metrics import PullRequestMetricsStore

            provider_metrics = MetricsStore(config.state_dir / "metrics.json").snapshot()
            pull_request_snapshot = PullRequestMetricsStore(
                config.state_dir / "pull-request-metrics.json",
                max_records=config.pull_request_history_limit,
            ).snapshot()
            print(
                json.dumps(
                    {
                        **provider_metrics,
                        "pull_requests": {
                            "capacity": pull_request_snapshot.get("capacity", {}),
                            "summary": pull_request_snapshot.get("summary", {}),
                        },
                    },
                    indent=2,
                )
            )
            return 0
        if args.command == "dashboard":
            if args.action == "show":
                snapshot = build_status_snapshot(config)
                print(render_status_markdown(snapshot, config.github_repository))
                return 0
            result = FactoryControlPanel(config).sync(force=args.force)
            print(
                json.dumps(
                    {
                        "issue": result.issue,
                        "issue_url": result.issue_url,
                        "status": result.status,
                        "published": result.published,
                        "command": result.command,
                    },
                    indent=2,
                )
            )
            return 0
        if args.command == "reconcile":
            expired = TaskStore(config.state_dir).prune_expired_leases()
            print(json.dumps({"expired_leases_released": expired}, indent=2))
            return 0
        if args.command == "alert-daemon-failed":
            sent = AlertService(config).send(
                "OpenHands factory daemon is down and automatic restart failed.",
                category="daemon-restart-failed",
            )
            return 0 if sent or config.telegram_bot_token is None else 1
        if args.command == "backlog":
            github = GitHubClient(
                config.github_repository,
                config.repository,
                config.github_token.get_secret_value(),
                base_branch=config.base_branch,
            )
            jobs = JobStore(
                config.state_dir / "jobs.json",
                max_repeated_failures=config.max_consecutive_failures,
            )
            if args.issue:
                targets = {str(issue) for issue in args.issue}
            else:
                labelled = {str(issue) for issue in github.list_quarantined_issues()}
                durable = {
                    task_id
                    for task_id, job in jobs.load().items()
                    if job.state is JobState.QUARANTINED
                }
                targets = labelled | durable
            numeric_targets = sorted(int(task_id) for task_id in targets if task_id.isdigit())
            github_requeued = github.requeue_quarantined_issues(
                numeric_targets,
                announce=args.announce,
            )
            durable_requeued = jobs.requeue_quarantined(targets)
            print(
                json.dumps(
                    {
                        "requeued": numeric_targets,
                        "github_labels_reset": github_requeued,
                        "durable_jobs_reset": durable_requeued,
                    },
                    indent=2,
                )
            )
            return 0
    except FactoryError as error:
        print(f"Factory error: {error}", file=sys.stderr)
        return 2
    return 2
