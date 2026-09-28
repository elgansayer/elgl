# PostGIS discovery contract

Issue: #1302

## Runtime path

Authenticated partner discovery enters `DiscoveryController` at `GET /discovery/partners`. `SearchQueryDto` treats latitude and longitude as a pair and bounds latitude to `-90..90`, longitude to `-180..180`, and `radius_metres` to `1,000..20,000,000` metres with a 50 km default. When coordinates are present, `DiscoveryService` calls the `search_nearby_users` Supabase RPC. The RPC performs the radius predicate with `ST_DWithin`, computes `ST_Distance`, and returns at most 100 discovery-safe profiles ordered nearest first.

The application continues to apply block filtering defensively after the RPC and enriches the returned profiles using the established discovery pipeline. VIP mock-location behavior remains owned by `DiscoveryService`; the database RPC receives only the already-selected search coordinates.

## Database trust boundary

`search_nearby_users` is `SECURITY DEFINER` because proximity lookup must efficiently inspect candidate profile locations without exposing those location rows directly to the browser. The privileged function therefore validates its own inputs instead of relying only on NestJS HTTP validation:

- latitude: `-90..90`
- longitude: `-180..180`
- radius: `1,000..20,000,000` metres
- optional age values: `1..120`, with minimum no greater than maximum

Invalid values raise SQLSTATE `22023` without echoing coordinates or other personal data. Browser roles (`anon` and `authenticated`) cannot execute the function directly. Only `service_role`, used by the authenticated backend, receives `EXECUTE`.

## Privacy and deletion

Spatial results exclude the requesting user, null locations, profiles hidden from discovery, profiles with deletion pending, and profiles already scheduled for deletion. The RPC returns only the established discovery projection rather than full `users` rows. It does not return email addresses, credentials, billing identifiers, raw location coordinates, or other private account fields.

No new location data is stored by this change. Existing account/profile deletion semantics remain authoritative, and no new retention policy is required.

## Performance

The RPC uses the existing location index and `ST_DWithin` predicate rather than loading candidate coordinates into NestJS. Results are hard-capped at 100 rows and ordered by computed distance with user ID as a deterministic tie-breaker. Existing repository migrations own the spatial index; this hardening migration does not rebuild it or introduce a blocking backfill.

## Failure handling and observability

HTTP validation rejects malformed public inputs before the RPC. The database repeats critical validation at the privileged boundary. Database/provider failures remain observable through the existing discovery degradation/circuit-breaker path and its sanitized degradation status/events. Neither the migration nor its errors log coordinates, profile content, credentials, or tokens.

The RPC signature and response projection are unchanged, so mixed backend versions can coexist during deployment.

## Verification

Automated coverage consists of:

- `backend/src/discovery/dto/search-query.dto.spec.ts` for HTTP coordinate-pair and radius validation;
- `backend/src/discovery/discovery.service.postgis.spec.ts` for NestJS RPC parameter mapping, VIP mock location behavior, blocked-user defense, and degradation behavior;
- `backend/src/database/migrations/20260823190500_harden_search_nearby_users_contract.spec.ts` for the database radius/privacy/privilege contract;
- the clean Supabase migration replay in repository CI.

Production smoke test after migration:

1. Query `/discovery/partners` with a valid coordinate pair and a small radius and confirm returned rows include finite `distance_metres` values in nearest-first order.
2. Repeat with a larger radius and confirm the result set can expand while remaining bounded.
3. Confirm hidden/deletion-pending test profiles are absent.
4. Confirm direct RPC execution as an authenticated browser role is denied.
5. Confirm the backend service-role request still succeeds.

## Rollout

1. Apply `20260823190500_harden_search_nearby_users_contract.sql`.
2. Verify the clean migration replay and migration-contract tests.
3. Deploy/restart backend instances normally; no coordinated frontend deployment is required.
4. Run the smoke test above and monitor the existing discovery degradation signals.

## Rollback

The migration is a forward replacement of the same RPC signature. If rollback is necessary, deploy a reviewed forward migration restoring the previous function body and grants; do not edit or delete an already-applied migration. No data backfill or destructive cleanup is required.

Do not restore direct `anon`/`authenticated` execution unless a separately reviewed client-side RPC contract is intentionally introduced, because the function bypasses RLS by design.
