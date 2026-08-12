from pathlib import Path

from openhands_factory.quality_gate import added_lines, inspect_diff


def test_added_lines_tracks_new_file_line_numbers() -> None:
    diff = """diff --git a/frontend/src/app/a.ts b/frontend/src/app/a.ts
--- a/frontend/src/app/a.ts
+++ b/frontend/src/app/a.ts
@@ -2,0 +3,2 @@
+const first = true;
+const second = true;
"""

    assert added_lines(diff) == [
        (Path("frontend/src/app/a.ts"), 3, "const first = true;"),
        (Path("frontend/src/app/a.ts"), 4, "const second = true;"),
    ]


def test_production_mock_and_any_are_blocking() -> None:
    diff = """diff --git a/frontend/src/app/service.ts b/frontend/src/app/service.ts
--- a/frontend/src/app/service.ts
+++ b/frontend/src/app/service.ts
@@ -1,0 +2,2 @@
+const mockConversation = 'fake response';
+const value = result as any;
"""

    findings = inspect_diff(diff)

    assert {finding.code for finding in findings} == {"production-mock", "unsafe-any"}


def test_test_mocks_are_allowed_but_skipped_tests_are_not() -> None:
    diff = """diff --git a/frontend/src/app/service.spec.ts b/frontend/src/app/service.spec.ts
--- a/frontend/src/app/service.spec.ts
+++ b/frontend/src/app/service.spec.ts
@@ -1,0 +2,2 @@
+const mockService = {};
+it.skip('works', () => {});
"""

    findings = inspect_diff(diff)

    assert [finding.code for finding in findings] == ["skipped-test"]


def test_normal_production_change_passes() -> None:
    diff = """diff --git a/backend/src/chat/chat.service.ts b/backend/src/chat/chat.service.ts
--- a/backend/src/chat/chat.service.ts
+++ b/backend/src/chat/chat.service.ts
@@ -10,0 +11,1 @@
+return this.messagesRepository.save(message);
"""

    assert inspect_diff(diff) == []
