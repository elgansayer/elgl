# Partner of the Week

Partner of the Week is a weekly Discovery highlight computed by `DiscoveryService.calculatePartnerOfWeek()` every Sunday at midnight. The feature reuses the normal discovery privacy boundary and stores only the selected user IDs in Redis.

## Eligibility

The candidate read is intentionally bounded to 50 profiles. A candidate must:

- be discoverable (`privacy_hide_from_search = false`);
- not be pending account deletion;
- have a non-empty display name;
- have at least one native and one target language;
- have `correction_ratio > 0.5`; and
- have a study streak of at least seven days.

The service validates those rules again after the datastore response so malformed or unexpectedly broad provider results cannot promote hidden or incomplete profiles.

## Ranking

Eligible candidates receive a deterministic composite score:

| Signal | Weight | Normalisation |
| --- | ---: | --- |
| Correction ratio | 30% | Existing 0-1 ratio |
| Average corrector rating | 35% | 1-5 rating mapped to 0-1 |
| Corrector rating count | 15% | Log-scaled against the candidate pool |
| Study streak | 20% | Log-scaled against the candidate pool |

The highest ten scores are cached. User ID is the final tie-breaker so identical inputs produce stable ordering. The Redis key is `partner_of_week_ids` and expires after seven days.

Corrector-score lookup is best-effort per candidate. A failure for one candidate does not abort the weekly refresh; that candidate receives the existing neutral/fallback score while candidates with verified rating history can still rank normally.

## Privacy and security

The cache stores IDs only. It does not copy profile text, languages, correction content, ratings, location, credentials, tokens, or other private payloads into Redis. Hidden and deletion-pending profiles are rejected both in the database query and in application-side validation.

Consumers must continue applying their normal discovery/blocking rules when resolving these IDs for a specific viewer. Partner of the Week is a ranking signal, not an authorization bypass.

## Failure handling and observability

Candidate-store failures and empty eligible sets clear the stale weekly cache instead of continuing to advertise a no-longer-valid winner. Redis refresh failures also attempt to remove stale state. Logs describe the calculation lifecycle and aggregate selected count without logging profile content.

Corrector-rating provider failures are isolated to the affected candidate. The scheduled job remains bounded to 50 candidates and publishes at most ten IDs, avoiding unbounded scans or cache growth.

## Verification

`backend/src/discovery/partner-of-week.spec.ts` locks:

- discovery visibility and completeness filters;
- the 50-candidate query bound;
- weighted ranking in favour of strongly rated correctors;
- per-candidate score-provider degradation;
- the ten-user output bound and seven-day TTL;
- deterministic tie-breaking; and
- stale-cache removal on empty/provider/Redis failure paths.

Repository CI remains authoritative for the full backend test, lint, build, database, and E2E suites.

## Rollout and rollback

No schema or API migration is required. Deploy as a normal backend change. Existing Redis values remain compatible because the key continues to contain a JSON array of user IDs.

Rollback is a code revert. If a rollback happens after ranking semantics change, deleting `partner_of_week_ids` is safe; the next successful scheduled calculation will recreate it.