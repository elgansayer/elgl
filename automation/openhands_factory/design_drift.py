"""Turn a design-sync drift failure into explicit repair instructions.

GitHub reports this gate only as the `constitution` check, and the local
failure tail is mostly the script's own passing self-tests, so repair agents
spent their whole budget without editing the preview or manifest item the
gate names (issues 1437, 1450 and 1478, 2026-10-29). The gate itself is
unchanged: the agent still has to update the preview or justify, in the
item's own manifest metadata, why the visual contract is unchanged, and the
independent review still judges that justification.
"""

from __future__ import annotations

import re
from pathlib import Path

from openhands_factory.repository_guard import ProcessRunner, run_process

DRIFT_SCRIPT = Path("scripts/check-design-sync-drift.mjs")
DRIFT_COMMAND = ("env", "DESIGN_SYNC_BASE_SHA=origin/main", "npm", "run", "check:design-sync-drift")
_FAILURE = re.compile(
    r"^- (?P<id>\S+): mapped implementation changed.*\n"
    r"\s+changed: (?P<changed>.+)\n"
    r"\s+update the preview to match: (?P<previews>.+)\n",
    re.MULTILINE,
)


def drift_guidance(output: str, task_id: str) -> str | None:
    """Return step-by-step instructions for each drifted item, or None."""
    failures = list(_FAILURE.finditer(output))
    if not failures:
        return None
    steps = "\n".join(
        f'- Item "{match["id"]}" (changed: {match["changed"].strip()}):\n'
        f"  (a) if the change alters what users see, edit {match['previews'].strip()} "
        "so the preview shows the new UI; or\n"
        f'  (b) if it does not, edit only the "{match["id"]}" item of '
        "design-sync.manifest.json and append to its implementationAudit string "
        f'"; issue-{task_id}-<short-slug> (<why the visual contract is unchanged>)".'
        for match in failures
    )
    return (
        "The design-sync drift gate failed (GitHub reports it as the `constitution` "
        "check). Fix it before anything else, choosing (a) or (b) for each item:\n"
        f"{steps}\n"
        "Do not edit other manifest items, repositoryPaths, previewPaths or the "
        "check script. Then run `DESIGN_SYNC_BASE_SHA=origin/main npm run "
        "check:design-sync-drift` from the repository root and confirm it passes."
    )


def check_design_drift(
    repository: Path, task_id: str, runner: ProcessRunner = run_process
) -> str | None:
    """Run the drift gate in a worktree and return repair guidance if it fails."""
    if not (repository / DRIFT_SCRIPT).is_file():
        return None
    result = runner(DRIFT_COMMAND, repository, 120)
    if result.returncode == 0:
        return None
    return drift_guidance(f"{result.stdout}\n{result.stderr}", task_id)
