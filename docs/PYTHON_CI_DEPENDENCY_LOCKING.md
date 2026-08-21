# Python CI dependency locking

This document records the Python dependency-resolution contract for the repository's canonical CI and implements the audit/documentation portion of CI/testing hardening roadmap stage 6.

## Current canonical Python job

Canonical CI installs the Factory on Python 3.13 with:

```sh
python -m pip install './automation[development]'
```

`automation/pyproject.toml` currently exact-pins every declared build, runtime, and development dependency with `==`, including Hatchling, filelock, httpx, OpenHands SDK/tools, Pydantic, mypy, pytest, pytest-cov, and Ruff.

That is useful protection against direct-dependency drift, but it is not a complete reproducibility guarantee. pip can still choose different versions of transitive dependencies when their upstream constraints permit newer releases.

## Policy

1. Direct build, runtime, and CI/development dependencies used by canonical CI remain exact-version pinned.
2. CI must not use `pip install -U`, floating VCS references, unversioned package names, or mutable branch/tag references for Factory verification.
3. Dependency updates must be explicit repository changes reviewed through normal CI.
4. A future transitive lock must be generated from the declared `automation/pyproject.toml`; it must not become a second hand-maintained source of dependency intent.
5. The lock/constraints file must cover the Python version used by canonical CI, currently Python 3.13.
6. Once a transitive lock is adopted, canonical CI must install with that lock/constraints input and fail when it is stale relative to `pyproject.toml`.
7. Prefer hashes for downloaded distributions when the chosen locking tool can produce and maintain them reliably.
8. Regeneration must be deterministic and documented, and automated dependency tooling should update the manifest and lock together.

## Recommended implementation path

The next dependency-resolution change should introduce one generated CI lock/constraints artifact under `automation/` using a single selected tool such as `uv` or `pip-tools`, commit the generated result, and add a drift check. The change should prove that the Factory's existing Ruff, mypy, pytest, and packaging checks remain green before the lock becomes authoritative.

Until that lands, exact direct pins are the deliberate interim control and the remaining transitive-resolution risk is explicit rather than hidden.

## Audit result

At the time of this audit, the canonical Python verification path is the Factory job in `.github/workflows/ci.yml`. Its package manifest uses exact direct pins; the unresolved reproducibility gap is transitive dependency selection. No dependency versions are changed by this documentation-only stage.
