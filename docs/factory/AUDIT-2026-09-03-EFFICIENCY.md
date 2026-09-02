# Factory efficiency audit: 2026-09-03

## Scope

This pass rechecked the OpenHands Factory control plane on current `main`, including provider routing and phase reasoning, retry/failover policy, durable task ownership and duplicate convergence, prompt/context bounds, issue admission, review/repair loops, concurrency, scheduling, GitHub refresh behaviour, required merge checks, stalled-task recovery, and GitHub Actions triggered by Factory maintenance pull requests.

The existing controls remain intentionally conservative: subscription-backed providers, bounded provider starts and fallback candidates, phase-aware reasoning, deterministic verification before merge, security review, independent exact-head review, `factory/independent-review`, `CI / required`, and exact-head merge protection are unchanged.

## Finding: an application production-boundary runner still started for Factory-only PRs

`Mock Backend Production Boundary` was triggered by every pull request. Its verifier reads application/deployment inputs and scans production artifacts for accidental mock-fixture activation, but a pull request restricted to `automation/**`, `config/factory/**`, `config/systemd/**`, and documentation cannot change that result.

That meant routine Factory efficiency/recovery PRs still allocated an Ubuntu runner, checked out the repository, set up Node.js, executed the verifier regression test, scanned the repository, and kept another CI check pending even when none of the verifier's inputs had changed. The Factory then had to continue polling that unrelated check before the exact head could converge toward merge.

## Change

The workflow now uses a narrow `pull_request.paths-ignore` guard for only those Factory/config/documentation paths. This prevents runner allocation for pure Factory maintenance while keeping the boundary workflow in scope for:

- every `.github/workflows/**` change;
- backend and frontend changes;
- deployment and infrastructure changes;
- Docker/Compose changes and other production artifacts;
- changes to the verifier or its tests; and
- pushes to `main`.

The guard intentionally does not ignore generic workflow files or product paths because the verifier scans those surfaces for production fixture activation.

## Expected efficiency impact

For a pure Factory PR, the change removes one unrelated GitHub Actions runner allocation and one pending check from the PR convergence set. It does not claim provider-token savings directly, but it reduces control-plane work and prevents a product-only baseline check from becoming an unnecessary CI-repair signal for a Factory change.

The repository rulesets currently require `CI / required` and `factory/independent-review`; `Mock Backend Production Boundary` is not a required branch-protection context. Both required contexts remain unchanged and must still pass on the reviewed SHA.

## Autonomy and quality floor

No quarantine or human-triage state is introduced. No retry, provider failover, task ownership, security review, independent review, reviewed-SHA protection, mergeability check, required status, or exact-head merge rule is weakened. Persistent failures remain machine-owned and recoverable through the existing autonomous paths.

Regression coverage in `automation/tests/test_factory_control_plane_efficiency.py` locks the new workflow-level filter and explicitly verifies that workflow, backend, frontend, deployment, and infrastructure inputs are not excluded.
