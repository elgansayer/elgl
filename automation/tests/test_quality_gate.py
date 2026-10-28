import subprocess
from pathlib import Path
from unittest.mock import Mock

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.quality_gate import check_quality_gate, is_test_path


def test_is_test_path() -> None:
    assert is_test_path(Path("frontend/src/app/example.spec.ts"))
    assert is_test_path(Path("backend/test/app.e2e-spec.ts"))
    assert is_test_path(Path("tests/test_foo.py"))
    assert not is_test_path(Path("frontend/src/app/example.ts"))
    assert not is_test_path(Path("backend/src/app.controller.ts"))


def test_check_quality_gate_blocks_production_mock() -> None:
    workflow = Mock()
    # Provide a mock diff output
    workflow.runner.return_value = Mock(
        stdout="""+++ b/backend/src/app.service.ts
@@ -1 +1,2 @@
+    return { id: 1, name: "mock user" };
"""
    )
    findings = check_quality_gate(workflow, "main")
    assert len(findings) == 1
    assert findings[0].code == "production-mock"
    assert findings[0].line == 1


def test_check_quality_gate_allows_test_mock() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(
        stdout="""+++ b/backend/test/app.e2e-spec.ts
@@ -1 +1,2 @@
+    return { id: 1, name: "mock user" };
"""
    )
    findings = check_quality_gate(workflow, "main")
    assert len(findings) == 0


def test_check_quality_gate_blocks_type_escapes() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(
        stdout="""+++ b/frontend/src/app.ts
@@ -1 +1,2 @@
+    const x = y as any;
"""
    )
    findings = check_quality_gate(workflow, "main")
    assert len(findings) == 1
    assert findings[0].code == "unsafe-type-escape"


def test_check_quality_gate_blocks_skipped_tests() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(
        stdout="""+++ b/frontend/src/app.spec.ts
@@ -1 +1,2 @@
+    it.skip("test", () => {});
"""
    )
    findings = check_quality_gate(workflow, "main")
    assert len(findings) == 1
    assert findings[0].code == "skipped-test"


def test_check_quality_gate_blocks_e2e_skip() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(
        stdout="""+++ b/frontend/cypress/example.cy.ts
@@ -1 +1,2 @@
+  cy.skip('not ready');
"""
    )

    findings = check_quality_gate(workflow, "main")

    assert [finding.code for finding in findings] == ["skipped-test"]


def test_check_quality_gate_blocks_provider_credential_artifacts() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(
        stdout="""+++ b/.codex/auth.json
@@ -0,0 +1 @@
+{"token":"opaque-value"}
"""
    )

    findings = check_quality_gate(workflow, "main")

    assert [finding.code for finding in findings] == ["credential-artifact"]


def test_check_quality_gate_blocks_high_confidence_secret_patterns() -> None:
    workflow = Mock()
    fake_token = "ghp_" + "A" * 24
    workflow.runner.return_value = Mock(
        stdout=(f'+++ b/backend/src/config.ts\n@@ -0,0 +1 @@\n+const token = "{fake_token}";\n')
    )

    findings = check_quality_gate(workflow, "main")

    assert [finding.code for finding in findings] == ["credential-leak"]
    assert fake_token not in findings[0].evidence


def test_check_quality_gate_reports_diff_failure() -> None:
    workflow = Mock()
    workflow.runner.return_value = Mock(returncode=1, stderr="fatal: bad revision", stdout="")

    with pytest.raises(FactoryError, match="Could not inspect quality diff"):
        check_quality_gate(workflow, "main")


def _git(repository: Path, *arguments: str) -> None:
    subprocess.run(("git", *arguments), cwd=repository, check=True, capture_output=True)


def _real_workflow(repository: Path) -> Mock:
    workflow = Mock()
    workflow.repository = repository
    workflow.runner = lambda arguments, cwd: subprocess.run(
        arguments, cwd=cwd, capture_output=True, text=True, check=False
    )
    return workflow


def _stale_branch(tmp_path: Path) -> Path:
    """A branch cut before origin/main later edited a tracked .claude file."""
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init", "-q", "-b", "main")
    _git(repository, "config", "user.email", "factory@example.invalid")
    _git(repository, "config", "user.name", "Factory")
    (repository / ".claude").mkdir()
    (repository / ".claude" / "CLAUDE.md").write_text("original\n")
    (repository / "app.ts").write_text("export const value = 1;\n")
    _git(repository, "add", ".")
    _git(repository, "commit", "-q", "-m", "base")
    _git(repository, "switch", "-q", "-c", "feature")
    (repository / ".claude" / "CLAUDE.md").write_text("updated on main\n")
    _git(repository, "commit", "-q", "-am", "main edits tracked .claude file")
    _git(repository, "update-ref", "refs/remotes/origin/main", "HEAD")
    _git(repository, "reset", "-q", "--hard", "HEAD~1")
    (repository / "app.ts").write_text("export const value = 2;\n")
    _git(repository, "commit", "-q", "-am", "branch changes production code only")
    return repository


def test_check_quality_gate_ignores_later_base_changes_on_stale_branch(tmp_path: Path) -> None:
    repository = _stale_branch(tmp_path)

    assert check_quality_gate(_real_workflow(repository), "main") == []


def test_check_quality_gate_still_blocks_branch_own_provider_artifacts(tmp_path: Path) -> None:
    repository = _stale_branch(tmp_path)
    (repository / ".codex").mkdir()
    (repository / ".codex" / "auth.json").write_text('{"token":"opaque-value"}\n')
    _git(repository, "add", ".codex/auth.json")
    _git(repository, "commit", "-q", "-m", "committed provider artefact")
    (repository / ".claude" / "CLAUDE.md").write_text("uncommitted branch edit\n")

    findings = check_quality_gate(_real_workflow(repository), "main")

    assert sorted((finding.code, str(finding.path)) for finding in findings) == [
        ("credential-artifact", ".claude/CLAUDE.md"),
        ("credential-artifact", ".codex/auth.json"),
    ]
