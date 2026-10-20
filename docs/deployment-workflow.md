# Deployment workflow

The repository publishes production container images through `.github/workflows/deploy.yml`. The workflow is intentionally downstream of the main `CI` workflow rather than rebuilding and publishing directly from a push event.

## Release contract

A deployment run starts only when the `CI` workflow completes successfully for `main`. Before checkout or registry authentication, the job reads the current `main` ref and compares it with `github.event.workflow_run.head_sha`. If a newer commit has reached `main`, the older successful run exits without publishing or promoting anything. The `deploy-main` concurrency group also cancels superseded deployment runs.

The workflow checks out exactly the tested commit and builds the production targets from `backend/Dockerfile` and `frontend/Dockerfile`. Each image is first pushed under an immutable commit-SHA tag. BuildKit cache, SBOM generation, and maximum provenance are enabled for both images.

The immutable images are scanned for HIGH and CRITICAL OS/library vulnerabilities. A matching vulnerability fails the deployment before provenance attestation or mutable-tag promotion. Only after both scans and attestations succeed are the resulting image digests promoted to `:latest` with `docker buildx imagetools create`. `:latest` is therefore a pointer to already-built, already-scanned digests; it is never produced by a separate rebuild.

## Security and permissions

The workflow uses `contents: read`, `packages: write`, `attestations: write`, and `id-token: write`. It does not require repository-content write access. Registry authentication uses the workflow-scoped `GITHUB_TOKEN`; no long-lived registry password is committed or printed.

Publishing is tied to the tested `main` SHA. Pull requests cannot invoke the image-publishing job directly, and a successful CI run for a stale `main` commit cannot overwrite `:latest`.

## Failure and recovery

- **CI fails:** no deployment job runs.
- **The successful CI SHA is stale:** the deployment exits before checkout/login/build and leaves existing image tags unchanged.
- **A Docker build or push fails:** the job stops; `:latest` is unchanged.
- **A vulnerability scan fails:** immutable SHA images may already exist in GHCR for inspection, but they are not attested/promoted by the remaining steps and `:latest` is unchanged.
- **Attestation fails:** `:latest` is unchanged.
- **Promotion fails part-way:** rerunning the successful workflow is safe because the immutable digest is unchanged and `imagetools create` is idempotent for the intended tag/digest mapping.

The workflow logs commit SHAs and build/promotion state, but should never log credentials or application/user data.

## Verification

`scripts/deploy-workflow-contract.test.mjs` is a read-only executable contract for the deployment safety properties. `Workflow lint` runs it whenever workflows or the contract itself change, alongside `audit-workflows.mjs` and `actionlint`.

Run it locally with:

```bash
node --test scripts/deploy-workflow-contract.test.mjs
```

The contract checks the successful-CI/main trigger, concurrency, least-privilege permissions, stale-SHA gate ordering, exact tested checkout, immutable SHA tags, production Docker targets, cache/SBOM/provenance settings, blocking vulnerability scans, attestations, and digest-only `:latest` promotion.

## Rollout and rollback

This change adds verification and documentation around the existing image-publishing workflow; it does not change application APIs, persisted data, or container runtime configuration. Roll out through the normal pull-request checks.

If the contract itself is incorrect, revert the contract/workflow-lint commit. Do not weaken `deploy.yml` merely to make the contract pass: first determine whether the workflow or the asserted safety property is wrong. Rolling back application images remains a registry/deployment operation using a previously verified immutable SHA/digest; do not rebuild an old source revision under the same release tag.
