import subprocess
from pathlib import Path


def test_constitution_default_scan_ignores_untracked_dependencies(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    scripts.mkdir(parents=True)
    source = Path(__file__).parents[2] / "scripts/verify-constitution.mjs"
    (scripts / source.name).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    (repository / "README.md").write_text("Tracked clean content\n", encoding="utf-8")
    dependency = repository / "automation/.venv/dependency.md"
    dependency.parent.mkdir(parents=True)
    dependency.write_text("Untracked dependency with an em dash: —\n", encoding="utf-8")
    subprocess.run(("git", "init"), cwd=repository, check=True, capture_output=True)
    subprocess.run(
        ("git", "add", "README.md", "scripts/verify-constitution.mjs"),
        cwd=repository,
        check=True,
        capture_output=True,
    )

    result = subprocess.run(
        ("node", "scripts/verify-constitution.mjs"),
        cwd=repository,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "Checked 1 files" in result.stdout


def test_constitution_ignores_negative_test_fixtures_but_checks_production(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    scripts = repository / "scripts"
    source_dir = repository / "frontend/src"
    scripts.mkdir(parents=True)
    source_dir.mkdir(parents=True)
    source = Path(__file__).parents[2] / "scripts/verify-constitution.mjs"
    (scripts / source.name).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    (source_dir / "negative.spec.ts").write_text(
        "expect(template).not.toContain('border-l');\n", encoding="utf-8"
    )
    production = source_dir / "component.ts"
    production.write_text("const classes = 'border-l';\n", encoding="utf-8")
    subprocess.run(("git", "init"), cwd=repository, check=True, capture_output=True)
    subprocess.run(("git", "add", "."), cwd=repository, check=True, capture_output=True)

    result = subprocess.run(
        ("node", "scripts/verify-constitution.mjs"),
        cwd=repository,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "component.ts" in result.stderr
    assert "negative.spec.ts" not in result.stderr
