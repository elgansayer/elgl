"""Deterministic fail-safe checks for obvious non-production changes."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class QualityFinding:
    code: str
    path: Path
    line: int
    detail: str


_PRODUCTION_PREFIXES = (
    "frontend/src/",
    "backend/src/",
    "automation/openhands_factory/",
)
_SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".py"}
_PRODUCTION_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "production-mock",
        re.compile(r"\b(?:mock\w*|fake\w*|stub\w*)\b", re.IGNORECASE),
        "new production code contains mock/fake/stub behaviour",
    ),
    (
        "not-implemented",
        re.compile(
            r"\bnot\s+(?:yet\s+)?implemented\b|\bactual\s+.+\s+would\s+be\b",
            re.IGNORECASE,
        ),
        "new production code explicitly describes unimplemented behaviour",
    ),
    (
        "unsafe-any",
        re.compile(r"\bas\s+any\b"),
        "new production TypeScript bypasses typing with `as any`",
    ),
)
_SKIPPED_TEST_PATTERN = re.compile(
    r"\b(?:describe|it|test)\.skip\s*\(|\b(?:xdescribe|xit|xtest)\s*\("
)


def _is_test_path(path: Path) -> bool:
    lowered = path.as_posix().lower()
    name = path.name.lower()
    return (
        "/tests/" in f"/{lowered}"
        or "/test/" in f"/{lowered}"
        or "/mocks/" in f"/{lowered}"
        or "/fixtures/" in f"/{lowered}"
        or ".spec." in name
        or ".test." in name
        or name.startswith("test_")
        or name.endswith("_test.py")
        or "mock-data" in name
    )


def _is_production_source(path: Path) -> bool:
    value = path.as_posix()
    return (
        path.suffix.lower() in _SOURCE_SUFFIXES
        and value.startswith(_PRODUCTION_PREFIXES)
        and not _is_test_path(path)
    )


def added_lines(diff_text: str) -> list[tuple[Path, int, str]]:
    """Return added lines and their new-file line numbers from a unified-zero diff."""
    result: list[tuple[Path, int, str]] = []
    current_path: Path | None = None
    next_line: int | None = None

    for raw_line in diff_text.splitlines():
        if raw_line.startswith("+++ "):
            target = raw_line[4:].strip()
            if target == "/dev/null":
                current_path = None
            else:
                current_path = Path(target[2:] if target.startswith("b/") else target)
            next_line = None
            continue

        if raw_line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,\d+)?", raw_line)
            next_line = int(match.group(1)) if match else None
            continue

        if current_path is None or next_line is None:
            continue
        if raw_line.startswith("\\"):
            continue
        if raw_line.startswith("+") and not raw_line.startswith("+++"):
            result.append((current_path, next_line, raw_line[1:]))
            next_line += 1
            continue
        if raw_line.startswith("-"):
            continue
        next_line += 1

    return result


def inspect_diff(diff_text: str) -> list[QualityFinding]:
    findings: list[QualityFinding] = []
    for path, line, text in added_lines(diff_text):
        if _is_production_source(path):
            for code, pattern, detail in _PRODUCTION_PATTERNS:
                if pattern.search(text):
                    findings.append(QualityFinding(code, path, line, detail))
        if _is_test_path(path) and _SKIPPED_TEST_PATTERN.search(text):
            findings.append(
                QualityFinding(
                    "skipped-test",
                    path,
                    line,
                    "new or modified tests are being skipped",
                )
            )
    return findings


def format_findings(findings: list[QualityFinding], *, limit: int = 20) -> str:
    bounded = findings[:limit]
    lines = [
        f"{finding.code}: {finding.path}:{finding.line}: {finding.detail}"
        for finding in bounded
    ]
    if len(findings) > limit:
        lines.append(f"... {len(findings) - limit} additional finding(s) omitted")
    return "\n".join(lines)
