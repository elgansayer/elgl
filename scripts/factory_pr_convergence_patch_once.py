from pathlib import Path


github_path = Path("automation/openhands_factory/github.py")
text = github_path.read_text(encoding="utf-8")
old = '''        output = self._run(
            (
                "gh",
                "pr",
                "list",
                "--repo",
                self.repository,
                "--state",
                "all",
                "--limit",
                str(limit),
                "--json",
                "number,title,body,baseRefName,headRefName,headRefOid,state,closedAt,mergedAt,"
                "isCrossRepository,labels,author,files",
            )
        )'''
new = '''        json_fields = (
            "number,title,body,baseRefName,headRefName,headRefOid,state,closedAt,mergedAt,"
            "isCrossRepository,labels,author"
        )
        if known_path_fingerprint is not None:
            json_fields += ",files"
        output = self._run(
            (
                "gh",
                "pr",
                "list",
                "--repo",
                self.repository,
                "--state",
                "all",
                "--limit",
                str(limit),
                "--json",
                json_fields,
            )
        )'''
if text.count(old) != 1:
    raise SystemExit("expected convergence query block exactly once")
github_path.write_text(text.replace(old, new), encoding="utf-8")


tests_path = Path("automation/tests/test_github.py")
tests = tests_path.read_text(encoding="utf-8")
anchor = '''def test_equivalent_pr_search_does_not_trust_factory_branch_prefix(
    tmp_path: Path,
) -> None:
'''
addition = '''def test_equivalent_pr_search_omits_files_until_path_fingerprint_is_known(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 90,
            "title": "Different wording",
            "body": "Fixes #42",
            "baseRefName": "main",
            "headRefName": "factory/42-fix-build",
            "headRefOid": "head-90",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
        }
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    matches = client.find_equivalent_pull_requests(
        Task("42", "Fix build", "Body", "github-issue", 0),
        known_branch="factory/42-fix-build",
        now=datetime(2026, 8, 24, tzinfo=UTC),
    )

    assert [match.number for match in matches] == [90]
    assert matches[0].reasons == frozenset({"issue-link", "branch-metadata"})
    json_fields = runner.calls[0][runner.calls[0].index("--json") + 1]
    assert json_fields.endswith("labels,author")
    assert "files" not in json_fields.split(",")


'''
if tests.count(anchor) != 1:
    raise SystemExit("expected equivalent-PR test anchor exactly once")
tests_path.write_text(tests.replace(anchor, addition + anchor), encoding="utf-8")


audit = Path("docs/factory/AUDIT-2026-08-29-PR-CONVERGENCE.md")
audit.write_text(
    """# Factory PR convergence payload audit - 2026-08-29

## Finding

The Factory performs a PR-convergence search before creating implementation work and again before creating a pull request. The first search does not yet have a local changed-path fingerprint, but it still requested the `files` field for every open or recent pull request.

At this audit snapshot the repository has 2,453 total pull requests and 185 open pull requests. Changed-file data cannot contribute a `changed-path-fingerprint` match until `known_path_fingerprint` exists, and changed-path evidence is not a strong canonical identity signal by itself.

## Change

`find_equivalent_pull_requests()` now requests pull-request file arrays only when `known_path_fingerprint` is available. The initial pre-work search retains issue links, logical task identity, branch metadata and explicit supersession links without asking GitHub to materialize thousands of changed-file arrays. The later pre-PR convergence search still requests files and preserves exact changed-path-fingerprint matching.

This removes data that is provably unused on the first scan rather than weakening duplicate detection.

## Quality and autonomy floor

No provider routing, reasoning tier, retry policy, task ownership, verification, security review, quality repair, independent review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability or branch-protection behavior changes.

The Factory remains fully autonomous. Persistent failures remain on machine-owned retry/backoff paths and no quarantine or human-triage workflow is introduced.

## Scope coordination

Open PR #8728 already owns backlog refresh cadence, production provider circuit policy and Codex bounded-phase effort. This change intentionally does not duplicate those edits. It addresses the separate payload cost inside each logical task's PR-convergence scan.
""",
    encoding="utf-8",
)
