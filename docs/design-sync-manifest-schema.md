# Design-sync manifest schema

The repository-owned `design-sync.manifest.json` is the machine-readable provenance contract between runtime implementation, deterministic repository previews, and the canonical Claude Design project. It is governed by `docs/claude-design-two-way-sync.md`.

## Schema version 1

Version 1 is described by `docs/design-sync-manifest.schema.json`. `schemaVersion` is deliberately explicit so incompatible future changes require a new schema version rather than silently changing the meaning of existing provenance records.

Every mapped artefact requires a stable `id`, `kind`, owner layer, one or more repository paths, one or more deterministic preview paths, a Claude Design path, sync direction, reconciliation commit provenance, and required state coverage. Repository and preview paths are repository-relative. `lastReconciledCommit` is either `null` while reconciliation is pending or a full lowercase 40-character Git SHA.

Stable IDs are references used by PRs and drift tooling. Renaming an ID is therefore a migration, not a cosmetic edit.

## Validation

Run:

```bash
node --test scripts/verify-design-sync-manifest.test.mjs
npm run check:design-sync
```

Validation fails when required provenance is missing, stable IDs are duplicated, preview mappings are duplicated, Claude Design paths are duplicated, repository/preview paths do not exist, enums are invalid, state lists contain duplicates, or the manifest declares an unsupported schema version.

`npm run check:design-sync-drift` remains the changed-only implementation/preview reconciliation gate. It compares the current branch with `DESIGN_SYNC_BASE_SHA` and requires mapped visual-contract changes to update their mapped preview or their own manifest metadata.

## Evolution

Additive optional metadata may be introduced within schema version 1 when it does not change existing field meaning. Any incompatible field rename, ownership semantic change, stable-ID interpretation change, or provenance-format change requires a new schema document and an incremented `schemaVersion`.

Rollback should restore the previous manifest and validator together. Do not downgrade the validator alone, because doing so can make invalid provenance appear valid.
