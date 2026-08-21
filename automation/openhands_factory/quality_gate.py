"""Deterministic quality gate for production code."""

import re
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import FactoryError
from openhands_factory.git_workflow import GitWorkflow


@dataclass(frozen=True)
class QualityFinding:
    code: str
    path: Path
    line: int | None
    summary: str
    evidence: str


def is_test_path(path: Path) -> bool:
    parts = path.parts
    if any(p in {"test", "tests", "__tests__", "spec", "fixtures", "e2e"} for p in parts):
        return True
    name = path.name.lower()
    if (
        name.startswith("test_")
        or name.endswith("_test.py")
        or name.endswith(".spec.ts")
        or name.endswith(".e2e-spec.ts")
    ):
        return True
    return bool(name == "conftest.py" or "mock" in name)


def check_quality_gate(workflow: GitWorkflow, base_branch: str) -> list[QualityFinding]:
    result = workflow.runner(("git", "diff", f"origin/{base_branch}", "-U0"), workflow.repository)
    returncode = getattr(result, "returncode", 0)
    if isinstance(returncode, int) and returncode != 0:
        raise FactoryError(f"Could not inspect quality diff: {result.stderr[-2000:]}")
    diff_output = result.stdout
    findings: list[QualityFinding] = []

    current_file = None
    added_line = 0

    production_mock_patterns = [
        re.compile(r"\bmocked\b", re.IGNORECASE),
        re.compile(r"\bmock\b", re.IGNORECASE),
        re.compile(r"\bfake\b", re.IGNORECASE),
        re.compile(r"\bstub\b", re.IGNORECASE),
        re.compile(r"\bplaceholder\b", re.IGNORECASE),
        re.compile(r"temporary implementation", re.IGNORECASE),
        re.compile(r"\bsimulate\b", re.IGNORECASE),
        re.compile(r"\bsimulated\b", re.IGNORECASE),
        re.compile(r"TODO:\s*implement", re.IGNORECASE),
        re.compile(r"TODO\s+implement", re.IGNORECASE),
        re.compile(r"not implemented", re.IGNORECASE),
        re.compile(r"not yet implemented", re.IGNORECASE),
        re.compile(r"will be implemented", re.IGNORECASE),
        re.compile(r"will be wired later", re.IGNORECASE),
        re.compile(r"for now", re.IGNORECASE),
        re.compile(r"sample data", re.IGNORECASE),
        re.compile(r"dummy data", re.IGNORECASE),
        re.compile(r"hard-coded temporary response", re.IGNORECASE),
    ]

    type_escape_patterns = [
        re.compile(r"\bas any\b"),
        re.compile(r"<any>"),
        re.compile(r":\s*any\b"),
        re.compile(r"unknown as\b"),
    ]

    skipped_test_patterns = [
        re.compile(r"\b(?:describe|it|test)\.skip\s*\("),
        re.compile(r"\b(?:xit|xdescribe)\s*\("),
        re.compile(r"\bcy\.skip\s*\("),
        re.compile(r"@pytest\.mark\.skip(?:if)?\b"),
        re.compile(r"pytest\.skip\s*\("),
    ]

    credential_patterns = [
        re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
        re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
        re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
        re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
        re.compile(r"BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY"),
    ]
    credential_roots = {
        ".claude",
        ".codex",
        ".gemini",
        ".openhands",
    }

    for line in diff_output.splitlines():
        if line.startswith("+++ b/"):
            current_file = Path(line[6:])
            added_line = 0
            if current_file.parts and current_file.parts[0] in credential_roots:
                findings.append(
                    QualityFinding(
                        code="credential-artifact",
                        path=current_file,
                        line=None,
                        summary="Provider credential artefact must not enter the repository",
                        evidence=str(current_file),
                    )
                )
            continue

        if line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,(\d+))?", line)
            if match:
                added_line = int(match.group(1))
            continue

        if line.startswith("+") and not line.startswith("+++"):
            added_text = line[1:]

            if current_file:
                for pattern in credential_patterns:
                    if pattern.search(added_text):
                        findings.append(
                            QualityFinding(
                                code="credential-leak",
                                path=current_file,
                                line=added_line,
                                summary="High-confidence credential material detected",
                                evidence="[redacted credential pattern]",
                            )
                        )
                        break

                # Skipped tests block
                for p in skipped_test_patterns:
                    if p.search(added_text):
                        findings.append(
                            QualityFinding(
                                code="skipped-test",
                                path=current_file,
                                line=added_line,
                                summary="Newly skipped test detected",
                                evidence=added_text.strip(),
                            )
                        )

                # Check production rules
                if not is_test_path(current_file):
                    for p in production_mock_patterns:
                        if p.search(added_text):
                            findings.append(
                                QualityFinding(
                                    code="production-mock",
                                    path=current_file,
                                    line=added_line,
                                    summary="Production mock or placeholder detected",
                                    evidence=added_text.strip(),
                                )
                            )

                    for p in type_escape_patterns:
                        if p.search(added_text):
                            findings.append(
                                QualityFinding(
                                    code="unsafe-type-escape",
                                    path=current_file,
                                    line=added_line,
                                    summary="Unsafe type escape detected",
                                    evidence=added_text.strip(),
                                )
                            )

            added_line += 1

        elif line.startswith(" ") and added_line:
            added_line += 1

    return findings
