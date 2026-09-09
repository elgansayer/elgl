# Mock fixture referential-integrity orchestration

Issue #7936 defines the integrity boundary for deterministic offline fixtures.

## Scope

The central mock fixture snapshot is built only when the existing explicit mock backend mode is enabled. `buildMockFixtureSnapshot()` now validates every relationship registered in its fixture graph before returning data. The current graph creates `users` before `linkedAccounts` and requires every linked account `user_id` to resolve to a seeded user.

The integrity module is deliberately generic so new offline collections can register their own foreign-key and polymorphic-reference rules as rooms, messages, media, transactions and other fixtures are added. Production services must not use this validator as a fallback data source.

## Contract

`validateMockFixtureIntegrity()` returns a deterministic report containing:

- whether the graph is valid;
- total collection and record counts;
- a topological collection creation order;
- structured issues with collection, record and field context;
- a human-readable summary suitable for local test diagnostics.

`assertMockFixtureIntegrity()` throws with the same human-readable summary when the graph is invalid. Snapshot construction uses the asserting form, so a dangling relationship cannot silently enter the explicit offline fixture set.

Reference rules support:

- ordinary foreign keys to a named collection;
- polymorphic references selected by a discriminator-to-collection map;
- optional references;
- alternate target fields;
- self-reference cycle policies.

Reply-like trees should use `cyclePolicy: 'forbid'`. Legitimate reciprocal social edges can use `cyclePolicy: 'allow'`. Cross-collection dependency cycles are always reported because they prevent a deterministic topological creation order.

## Determinism and parallel safety

Validation is pure and does not mutate fixture records, generator state or global process state. Rebuilding a snapshot with the same documented seed therefore remains byte-stable, and independent workers can validate isolated snapshots without shared mutable integrity state.

## Adding a fixture collection

Add the collection to the central snapshot, then register it in the `assertMockFixtureIntegrity()` definition list. Declare every relationship that points to another seeded collection. The dependency graph will derive a safe creation order and CI will fail if a referenced record is missing, an identifier is duplicated, a forbidden self-cycle is introduced, or collection dependencies become circular.

For polymorphic records, map every supported discriminator explicitly. Unknown discriminator values fail closed instead of guessing a target collection.

## Verification

Backend coverage exercises topological ordering across users, rooms, messages, media and transactions; dangling foreign keys; duplicate identifiers; polymorphic references; forbidden reply cycles; allowed social cycles; and circular collection dependencies. Existing mock-data tests rebuild the central snapshot repeatedly, so the live offline users and linked accounts also pass the integrity assertion.

The repository's mock-backend production-boundary check remains authoritative for ensuring fixture data is unavailable unless mock mode is explicitly enabled.

## Rollback

Revert the integrity module, its snapshot registration, tests and this document together. No database migration or persisted user data is involved. Do not work around an integrity failure by weakening a reference rule or returning fake production success; correct the fixture graph instead.
