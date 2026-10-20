# Discovery interest filter

Issue: #1810

## Contract

Discovery exposes a single-select interest filter in the existing partner-search UI. Selecting a tag sends `interests=<tag>` to `GET /api/discovery/partners`; clearing the selection omits the parameter. The backend normalizes the tag with Unicode NFKC, trims it, lowercases it, rejects comma-delimited/control-character input, and caps it at the database column limit of 50 characters.

Online non-spatial discovery applies PostgreSQL array overlap against `public.users.interests`. Nearby/PostGIS discovery uses the existing bounded proximity RPC and then applies the same exact normalized interest match to its returned `interests` array. The existing privacy-hide, deletion, block-list, age/language and VIP boundaries remain authoritative.

Offline discovery applies the same interest requirement to cached partner profiles before rendering results. `interests` is authoritative; `hobbies` is accepted only as a legacy cached-profile compatibility field so mixed-version/offline clients do not lose valid matches during migration.

## Performance and data

`public.users.interests` is an optional `VARCHAR(50)[]`. Migration `20260827001000_index_discovery_interests.sql` adds a partial GIN index for the array-overlap query. The migration is additive and safe to retry. No new personal data is introduced and no interest values are logged by this feature.

The filter is intentionally single-select because the shipped Discovery control is radio-style and its behavior is “match this hobby”. Multiple selected interests would require a separate product decision for AND/OR semantics. Comma-separated input is therefore rejected rather than being interpreted ambiguously.

## Failure behavior

- Invalid interest query values fail normal NestJS DTO validation before database access.
- Online search continues to use the existing bounded/fallback Discovery behavior.
- Offline filtering is deterministic and local; malformed cached interest entries are ignored.
- Clearing the UI interest selection removes the predicate entirely.

## Accessibility

The existing Discovery interest chips remain keyboard-operable Spartan buttons with an explicit “Any” state. The filter does not communicate selection using interest text alone; the existing checked/selected styling and accessible labels remain in place.

## Verification

Focused automated coverage verifies:

- DTO normalization and bounds;
- ordinary PostgreSQL overlap filtering;
- PostGIS result filtering;
- omission when no interest is selected;
- offline cached interest filtering, including the legacy `hobbies` compatibility field;
- clean database replay of the additive GIN index migration through the repository CI database job.

## Rollout and rollback

Deploy the additive migration before or with the application build. Older application versions are unaffected by the index. Roll back application code normally if required; leaving the index in place is harmless. If the index itself must be removed after rollback, use a forward migration with `DROP INDEX IF EXISTS public.users_interests_gin_idx` rather than editing migration history.
