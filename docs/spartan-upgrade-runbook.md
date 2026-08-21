# Spartan upgrade and Helm regeneration runbook

This runbook governs updates to the repository-owned Spartan integration.

## Architecture

- `@spartan-ng/brain` is the installed behaviour/accessibility layer.
- `@spartan-ng/cli` is the generator and migration tool.
- `frontend/components.json` configures Helm generation into `frontend/src/app/components/ui` using the `nova` style and `@spartan-ng/helm` import alias.
- Generated Helm code is repository-owned and may contain intentional Relay/product customisation, but accidental drift should remain reviewable.
- Feature code consumes approved Relay/Helm APIs rather than importing Brain directly unless a documented temporary migration exception exists.

## Version policy

Keep `@spartan-ng/brain` and `@spartan-ng/cli` on the same major/minor release line. A Spartan dependency update must change both together unless the upstream release explicitly documents otherwise.

## Pre-upgrade checklist

1. Read the Spartan update guide and release notes for the target version.
2. Confirm Angular, Tailwind and `@ng-icons` compatibility.
3. Record the current `frontend/components.json` configuration and the changed Helm directories.
4. Ensure the branch starts from green canonical CI.
5. Search for existing Spartan migration issues/PRs that overlap the affected components.

## Upgrade procedure

From `frontend/`:

```bash
npm install @spartan-ng/brain@<version> --save
npm install @spartan-ng/cli@<version> --save-dev
npx ng g @spartan-ng/cli:info --json
npx ng g @spartan-ng/cli:healthcheck
```

The CLI `info --json` command is read-only and should report the workspace configuration, package versions and installed/available components. The healthcheck should be run after dependency updates and meaningful Spartan migrations.

Do not run automatic migrations directly on `main`. Healthcheck fixes and regenerated Helm code belong on a reviewable branch.

## Helm regeneration review

When a component needs upstream Helm refresh:

1. Identify the specific component(s) and their current Relay/product customisation.
2. Regenerate only the relevant component through the supported Spartan CLI.
3. Review the full diff under `frontend/src/app/components/ui`.
4. Preserve intentional semantic-token, accessibility and product-specific adaptations.
5. Reject unrelated generated churn and do not overwrite Relay public APIs blindly.
6. Update repository previews/design-sync metadata when the shared visual contract changes.

The goal is not byte-for-byte equality with upstream Helm. Helm is owned code. The goal is to make divergence intentional, documented and reviewable.

## Required verification

After an upgrade or Helm regeneration:

```bash
npm run check:spartan-health
npm run check:spartan-boundaries
npm run check:design-sync
npm run lint:check
npm run build
npm test
```

Also verify the applicable UI state matrix: light/dark, keyboard focus, disabled/error/loading states, RTL, responsive layouts, high zoom/reflow, reduced motion and forced colours.

## Bundle and runtime review

- Compare frontend bundle output for unexpected growth.
- Confirm no duplicate primitive implementation or package was introduced.
- Verify overlay/focus/keyboard behaviour for changed interactive primitives.
- Verify SSR/build output where affected.

## Rollback

If an upgrade cannot pass the full gate:

1. Revert Brain and CLI package changes together.
2. Restore the prior lockfile.
3. Revert generated Helm changes from the failed upgrade branch.
4. Re-run canonical verification on the restored version.
5. Document the blocking upstream incompatibility in the issue/PR before retrying.

Never partially roll back Brain while retaining generated Helm migrations that require the newer API.