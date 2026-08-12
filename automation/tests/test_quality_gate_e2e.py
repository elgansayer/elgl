from openhands_factory.quality_gate import inspect_diff


def test_cypress_skipped_test_is_blocked() -> None:
    diff = """diff --git a/e2e/learning.cy.ts b/e2e/learning.cy.ts
--- a/e2e/learning.cy.ts
+++ b/e2e/learning.cy.ts
@@ -4,0 +5,1 @@
+it.skip('completes the learning loop', () => {});
"""

    findings = inspect_diff(diff)

    assert [finding.code for finding in findings] == ["skipped-test"]
