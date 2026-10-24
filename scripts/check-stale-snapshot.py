#!/usr/bin/env python3
"""Fail a pull request that silently rolls files back to older base versions.

In October 2026 about 19 bot branches whose commits were whole-tree snapshots of
months-old sandboxes were merged. Each one set hundreds of files back to blobs
that had already been superseded on main, deleting ~110k lines of reviewed work
without any diff a reviewer would read as a revert.

Signal (high precision): a path the PR changes whose head blob is byte-identical
to an *earlier* blob of the same path on the base branch's first-parent history,
while the base has since moved on. Ordinary edits produce new blobs; deliberate
reverts are allowed by the `intentional-revert` label (or --allow).

Usage: check-stale-snapshot.py --base origin/main [--head HEAD] [--threshold 2]
Exit 0 = clean, 1 = stale snapshot detected, 2 = usage/git error.
"""

from __future__ import annotations

import argparse
import subprocess
import sys

NULL_BLOB = "0" * 40


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(f"git {' '.join(args[:3])} failed: {result.stderr.strip()}\n")
        sys.exit(2)
    return result.stdout


def changed_blobs(merge_base: str, head: str) -> list[tuple[str, str, str]]:
    """(path, merge-base blob, head blob) for every path the PR modifies."""
    raw = git("diff", "--raw", "--no-renames", "--no-abbrev", "-z", merge_base, head)
    fields = raw.split("\0")
    changes = []
    for index in range(0, len(fields) - 1, 2):
        meta, path = fields[index], fields[index + 1]
        if not meta.startswith(":"):
            continue
        _, _, before, after, _ = meta[1:].split(" ")
        changes.append((path, before, after))
    return changes


def earlier_blobs(merge_base: str, path: str) -> set[str]:
    """Every blob the path held on the base line before its merge-base version."""
    raw = git(
        "log", "--first-parent", "--no-renames", "--no-abbrev", "--format=", "--raw",
        merge_base, "--", path,
    )
    blobs = set()
    for line in raw.splitlines():
        if line.startswith(":"):
            blobs.update(line[1:].split(" ")[2:4])
    blobs.discard(NULL_BLOB)
    return blobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", required=True, help="base branch ref, e.g. origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument(
        "--threshold", type=int, default=2,
        help="fail when at least this many paths revert to older base blobs",
    )
    parser.add_argument("--allow", action="store_true", help="report only (intentional revert)")
    args = parser.parse_args()

    merge_base = git("merge-base", args.base, args.head).strip()
    reverted = []
    for path, before, after in changed_blobs(merge_base, args.head):
        if after == NULL_BLOB or before == NULL_BLOB:
            continue  # additions and deletions are ordinary PR intent
        if after in earlier_blobs(merge_base, path):
            reverted.append(path)

    if not reverted:
        print("No stale-snapshot reverts: every changed file is a new version.")
        return 0

    print(
        f"{len(reverted)} changed file(s) are byte-identical to an older version on "
        f"{args.base} (rolled back past later reviewed changes):"
    )
    for path in sorted(reverted)[:200]:
        print(f"  {path}")
    if len(reverted) > 200:
        print(f"  ... and {len(reverted) - 200} more")

    if args.allow:
        print("Allowed: the pull request is labelled as an intentional revert.")
        return 0
    if len(reverted) < args.threshold:
        print(f"Below the failure threshold ({args.threshold}); reported for review only.")
        return 0
    print(
        "\nThis usually means the branch was built from a stale snapshot. Rebase the "
        "intended change onto the current base, or label the PR `intentional-revert` "
        "if rolling these files back is deliberate."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
