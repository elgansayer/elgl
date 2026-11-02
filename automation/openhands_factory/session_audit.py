"""Read-only checkpoint/lease reconciliation, never account-wide enrolment."""

from __future__ import annotations

import os
from collections import Counter
from pathlib import Path

from filelock import Timeout

from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import SessionIdentityJournal

MAX_AUDIT_RECORDS = 1000


def audit_sessions(
    store: ProviderCapacityStore, directory: Path, *, codex_socket: Path | None = None
) -> dict[str, object]:
    """Bound observations and withhold any authority to resume a model process.

    Historical dead records are expected. A live recorded guardian without a
    current compatible token is an inconsistency. No record can establish that
    outside-protocol participants, GUI agents or remote sessions are accounted.
    """
    report: dict[str, object] = {
        "schema": "repo-factory.session-audit.v1",
        "account_wide_coverage_proven": False,
        "continuity_authorised": False,
        "scope": "retained guardian checkpoints and current local shared primary only",
        "records": [],
        "errors": [],
    }
    errors: list[str] = []
    records: list[dict[str, object]] = []
    checkpoints = []
    try:
        journal = SessionIdentityJournal(directory, create=False)
        descriptor = journal._open_directory()
        try:
            with os.scandir(descriptor) as entries:
                names: list[str] = []
                for entry in entries:
                    if len(names) >= MAX_AUDIT_RECORDS:
                        raise ValueError("Journal enumeration limit exceeded")
                    names.append(entry.name)
        finally:
            os.close(descriptor)
        for name in sorted(names):
            try:
                if not name.endswith(".json"):
                    raise ValueError("Unexpected journal entry")
                checkpoint = journal.load(name.removesuffix(".json"))
                # Validate compatibility without renewing/releasing the handle.
                store._validate_handle(checkpoint.lease)
                checkpoints.append(checkpoint)
                records.append(
                    {
                        "session_id": checkpoint.session_id,
                        "provider": checkpoint.lease.provider,
                        "guardian_pid": checkpoint.guardian.pid,
                        "guardian_live": checkpoint.guardian.matches_live(),
                    }
                )
            except (OSError, ValueError):
                # Neither arbitrary filenames nor exception text is public output.
                errors.append("invalid_or_incompatible_checkpoint")
    except FileNotFoundError:
        errors.append("journal_missing")
    except (OSError, ValueError):
        errors.append("journal_unavailable_unsafe_or_over_limit")
    try:
        counts, owned, incompatible = store.audit_renewable_leases([c.lease for c in checkpoints])
        report["reader_compatible_slot_counts"] = counts
        report["reader_incompatible_live_slot_counts"] = incompatible
        if any(incompatible.values()):
            errors.append("unexpired_leases_outside_reader_bound")
        for record, current in zip(records, owned, strict=True):
            record["lease_current"] = current
            record["status"] = (
                "live_recorded_guardian_and_lease"
                if record["guardian_live"] and current
                else "live_guardian_without_current_lease"
                if record["guardian_live"]
                else "dead_guardian_with_retained_lease"
                if current
                else "historical_dead_guardian"
            )
    except (OSError, ValueError, TypeError, KeyError, Timeout):
        errors.append("current_capacity_primary_unavailable_or_invalid")
        for record in records:
            record["status"] = "lease_unknown"
    report["records"] = records
    report["errors"] = errors
    report["status_counts"] = dict(Counter(str(record["status"]) for record in records))
    if codex_socket is not None:
        from openhands_factory.codex_observer import observe_codex

        observed = observe_codex(codex_socket)
        report["codex_manual_observer"] = observed
        if not observed["inventory_complete"]:
            errors.append("codex_manual_inventory_unavailable")
        elif observed["loaded_threads"] != 0:
            errors.append("codex_threads_not_correlated_with_broker_leases")
    report["observations_consistent"] = not errors and all(
        record["status"] in {"live_recorded_guardian_and_lease", "historical_dead_guardian"}
        for record in records
    )
    return report
