# Voice Room Active discovery filter

Issue: #1708

## Product contract

Discovery exposes an optional **Voice Room Active** filter. When enabled, the normal discovery candidate set is intersected with users who are currently hosting a public active audio room. When disabled, discovery does not query the audio-room host list and preserves the normal ranking/filtering path.

The filter is additive to the existing discovery boundaries. Blocked users, accounts hidden from discovery, deletion-pending accounts, language filters, age/radius filters and other eligibility rules continue to apply before the active-host intersection. Enabling the filter never broadens the candidate set.

The Angular client sends `voice_room_active=true` only when the control is enabled. The backend DTO accepts the filter as the existing optional boolean query parameter, and `DiscoveryService` applies it consistently to ordinary, PostGIS/fallback and degradation-aware partner search paths.

## Privacy and security

`AudioRoomsService.getActiveHostIds()` reads only `host_id` and `is_private` from active room records. Hosts of private rooms are excluded before IDs are returned to discovery, and duplicate host IDs are collapsed. The discovery response does not reveal private room IDs, titles, invitation lists or listener identities.

The endpoint remains behind the existing authenticated discovery boundary. No additional user state is persisted by enabling the filter, and no new database migration is required.

## Failure behavior

A normal Supabase read failure while resolving active hosts returns an empty host set. In that state an active-only search returns no matching hosts rather than exposing private-room hosts or stale room metadata. The failure is recorded through the existing audio-room logger without intentionally including room content.

`DiscoveryService` also retains its existing degradation behavior for an unexpected exception from the audio-room subsystem: ordinary discovery remains available instead of failing the entire partner search. This is deliberately separate from the normal database-error path above and is covered by regression tests.

The UI uses the standard discovery loading, empty and retry/error surfaces. The toggle is a native Spartan checkbox with an associated label and remains keyboard-operable at high zoom/reflow.

## Verification

Focused backend coverage verifies:

- the disabled filter does not call the audio-room provider;
- enabled filtering returns only matching active host IDs;
- an empty active-host set produces an empty filtered result;
- unexpected audio-room exceptions preserve the existing discovery degradation path;
- only public active rooms contribute host IDs;
- duplicate public hosts are de-duplicated; and
- room-provider read failures fail closed to an empty host set.

Repository CI remains authoritative for the complete backend unit, lint, build and E2E suites.

## Rollout and rollback

This change has no schema or configuration dependency and can roll out with the backend independently of older clients. Older clients simply omit `voice_room_active` and retain existing discovery behavior.

Rollback is a normal application-code revert. There is no persisted state or database cleanup to perform.
