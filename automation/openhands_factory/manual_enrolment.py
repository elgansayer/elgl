"""Account one outside-protocol manual session in the shared provider capacity.

The guardian holds one renewable slot under the router's own provider key and
limit while the exact participant process (PID plus start time) stays alive, and
releases it when that process exits or the guardian is stopped. It never signals,
adopts or resumes the participant and makes no model call. The audit then reports
the session as a live recorded guardian with a current lease. This does not prove
account-wide coverage: unenrolled sessions remain unknown.
"""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import Callable

from openhands_factory.config import FactoryConfig
from openhands_factory.provider_capacity import (
    ProviderCapacityStore,
    maximum_agent_lease_seconds,
)
from openhands_factory.session_identity import (
    ProcessIdentity,
    SessionCheckpoint,
    SessionIdentityJournal,
)

MAX_LABEL_LENGTH = 200


def enrol_manual_session(
    config: FactoryConfig,
    provider: str,
    participant_pid: int,
    label: str,
    *,
    wait_seconds: int = 0,
    sleep: Callable[[float], None] = time.sleep,
    stop: Callable[[], bool] = lambda: False,
) -> dict[str, object]:
    spec = config.agents.providers.get(provider)
    if spec is None:
        raise ValueError(f"Unknown provider {provider!r}")
    if not label or len(label) > MAX_LABEL_LENGTH or any(c in label for c in ":\n\r"):
        raise ValueError("Label must be a short single-line name without ':'")
    participant = ProcessIdentity.capture(participant_pid)
    if participant.uid != os.geteuid():
        raise ValueError("Participant must belong to this operating-system user")
    store = ProviderCapacityStore(
        config.provider_capacity_dir, max_lease_seconds=maximum_agent_lease_seconds(config)
    )
    owner = f"manual:{provider}:{label}:pid={participant.pid}:start={participant.start_ticks}"
    lease = store.acquire_renewable(
        provider, limit=spec.max_concurrency, owner=owner, wait_seconds=wait_seconds
    )
    try:
        checkpoint = SessionCheckpoint(
            str(uuid.uuid4()), ProcessIdentity.capture(os.getpid()), lease
        )
        SessionIdentityJournal(config.state_dir / "manual-session-identities").create(checkpoint)
        interval = max(lease.lease_seconds // 3, 1)
        renewals = 0
        while not stop() and participant.matches_live():
            sleep(interval)
            if stop() or not participant.matches_live():
                break
            # Raises if the slot expired or ownership was lost; never reacquires.
            store.renew(lease)
            renewals += 1
        return {
            "session_id": checkpoint.session_id,
            "provider": provider,
            "owner": owner,
            "renewals": renewals,
            "ended": "stopped" if stop() else "participant exited",
        }
    finally:
        store.release_renewable(lease)
