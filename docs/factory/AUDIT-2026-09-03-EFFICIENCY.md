# Factory efficiency audit: 2026-09-03

## Scope

This pass rechecked the OpenHands Factory control plane on current `main`, including provider routing and phase reasoning, retry/failover policy, durable task ownership and duplicate convergence, prompt/context bounds, issue admission, review/repair loops, concurrency, scheduling, GitHub refresh behaviour, required merge checks, stalled-task recovery, and GitHub Actions triggered by Factory maintenance pull requests.

The existing controls remain intentionally conservative: subscription-backed providers, bounded provider starts and fallback candidates, phase-aware reasoning, deterministic verification before merge, security review, independent exact-head review, `factory/independent-review`, `CI / required`, and exact-head merge protection are unchanged.

## Finding: an application production-boundary runner still started for irrelevant Factory changes

`Mock Backend Production Boundary` was triggered by every pull request. Its verifier reads a fixed set of backend/frontend boundary files and scans only paths it classifies as production artifacts: workflow files, Dockerfiles, Docker Compose files, `deploy/**`, `infra/**`, and paths containing `.production` or `.prod.`. Ordinary Factory Python, prompt, Factory configuration, systemd configuration, and documentation changes therefore cannot affect its result unless their path itself matches one of those production-artifact markers.

That meant routine Factory efficiency/recovery PRs still allocated an Ubuntu runner, checked out the repository, set up Node.js, executed the verifier regression test, scanned the repository, and kept another CI check pending even when none of the verifier's inputs had changed. The Factory then had to continue polling that unrelated check before the exact head could converge toward merge.

## Change

The pull-request path filter now starts from all repository paths, excludes only the ordinary Factory-only surfaces, then deliberately re-includes every path-marker family used by the verifier's production-artifact classifier. The order is significant: the later positive patterns override earlier exclusions for Dockerfile, Docker Compose, `.production`, and `.prod.` paths, including when those names appear under an otherwise excluded directory.

This prevents runner allocation for irrelevant Factory-only changes while retaining the boundary workflow for:

- every `.github/workflows/**` change;
- backend and frontend boundary inputs;
- deployment and infrastructure paths;
- Dockerfile and Docker Compose artifacts even under otherwise excluded directories;
- `.production` and `.prod.` artifacts even under otherwise excluded directories;
- changes to the verifier or its tests; and
- pushes to `main`.

## Expected efficiency impact

For a pure Factory PR whose changed files are outside the verifier's input surface, the change removes one unrelated GitHub Actions runner allocation and one pending check from the PR convergence set. It does not claim provider-token savings directly, but it reduces control-plane work and prevents a product-only boundary check from becoming an unnecessary CI-repair signal for a Factory change.

The repository rulesets currently require `CI / required` and `factory/independent-review`; `Mock Backend Production Boundary` is not a required branch-protection context. Both required contexts remain unchanged and must still pass on the reviewed SHA.

## Autonomy and quality floor

No quarantine or human-triage state is introduced. No retry, provider failover, task ownership, security review, independent review, reviewed-SHA protection, mergeability check, required status, or exact-head merge rule is weakened. Persistent failures remain machine-owned and recoverable through the existing autonomous paths.

Regression coverage in `automation/tests/test_factory_control_plane_efficiency.py` asserts the complete ordered pull-request path list, including the production-artifact re-inclusions, so a future broad exclusion cannot silently widen the skip surface.
