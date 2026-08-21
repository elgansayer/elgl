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
+    const mockData = 'mock';
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
