"""Factory operator command line interface."""

from __future__ import annotations

import argparse
import json
import sys

from openhands_factory.alerts import AlertService
from openhands_factory.authentication import authenticate_openai
from openhands_factory.config import FactoryConfig
from openhands_factory.daemon import FactoryDaemon, set_paused
from openhands_factory.doctor import Check, run_doctor
from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient
from openhands_factory.metrics import MetricsStore
from openhands_factory.oauth_health import smoke_openai_subscription
from openhands_factory.provider_profiles import discover_gemini_models, discover_opencode_models
from openhands_factory.state import read_json
from openhands_factory.task_source import TaskStore


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
    task = subcommands.add_parser("task")
    task.add_argument("action", choices=("run",))
    task.add_argument("--issue", type=int)
    task.add_argument("--dry-run", action="store_true")
    subcommands.add_parser("daemon")
    subcommands.add_parser("status")
    subcommands.add_parser("pause")
    subcommands.add_parser("resume")
    subcommands.add_parser("metrics")
    subcommands.add_parser("reconcile")
    subcommands.add_parser("alert-daemon-failed")
    backlog = subcommands.add_parser("backlog")
    backlog.add_argument("action", choices=("requeue-quarantined",))
    return result


def _config() -> FactoryConfig:
    return FactoryConfig.from_environment()


def _doctor_checks(config: FactoryConfig, *, online: bool) -> list[Check]:
    checks = run_doctor(config, online=online)
    if online:
        oauth = smoke_openai_subscription(config)
        checks.append(Check("openai-subscription-online", oauth.passed, f"{oauth.kind}: {oauth.detail}"))
    return checks


def main(arguments: list[str] | None = None) -> int:
    args = parser().parse_args(arguments)
    try:
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
            checks = _doctor_checks(config, online=True)
            provider_checks = [
                check
                for check in checks
                if check.name in {"openai-subscription-online", "opencode-go", "gemini"}
            ]
            for check in provider_checks:
                print(f"{'PASS' if check.passed else 'FAIL'} {check.name}: {check.detail}")
            return 0 if all(check.passed for check in provider_checks) else 1
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
            return FactoryDaemon(config).run()
        if args.command in {"pause", "resume"}:
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
            print(json.dumps(MetricsStore(config.state_dir / "metrics.json").snapshot(), indent=2))
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
            requeued = github.requeue_quarantined_issues()
            print(json.dumps({"requeued": requeued}, indent=2))
            return 0
    except FactoryError as error:
        print(f"Factory error: {error}", file=sys.stderr)
        return 2
    return 2
