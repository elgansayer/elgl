# Voice call end-to-end media encryption

Issue: #1177

## Scope

Direct LiveKit call rooms now require client-side media E2EE before a voice participant connects. The LiveKit SFU receives encrypted media frames and never receives the media-encryption key.

The application API remains the authenticated signalling/key-broker plane. It generates 256 bits of random key material for each two-person room and stores that material only in Redis for one hour, matching the LiveKit token lifetime. Keys are not written to Supabase tables, analytics, metrics, or logs.

This protects media from the LiveKit media plane. It is not a claim that the application signalling tier is zero-knowledge: the authenticated API brokers the ephemeral key to the two intended participants over TLS.

## Call lifecycle

1. `POST /video-calls/start` requires an authenticated caller and a validated `remoteUserId`.
2. The service creates a two-person LiveKit room and caller token.
3. `VideoCallsEncryptionService` generates a 32-byte CSPRNG key and stores `{ key, participants }` in Redis under the generated room ID for 3600 seconds.
4. The start response returns the caller token, room ID, ICE configuration, and ephemeral E2EE key with `Cache-Control: no-store`.
5. `POST /video-calls/accept` validates the generated room ID and checks the authenticated user against the Redis participant allowlist before minting a LiveKit token.
6. `LivekitService` creates an `ExternalE2EEKeyProvider` and dedicated LiveKit E2EE worker, sets the key, and only then creates/connects the room.
7. Leaving a call or exhausting connection retries terminates the worker and clears local call state.

## Failure behavior

Encryption is fail-closed. Calls do not fall back to plaintext when:

- Redis/key brokering is unavailable;
- the room session expired;
- the authenticated user is not one of the two intended participants;
- a client receives a token response without E2EE material;
- the browser cannot initialize the LiveKit E2EE worker.

LiveKit control-plane degradation may still use the existing token fallback, but only while the independent E2EE session is available. This keeps media encryption mandatory during that degraded path.

Missing and unauthorized call sessions intentionally return the same generic `Call is unavailable` authorization error so room existence is not disclosed.

## Security and privacy

- Room IDs are validated before they can be used in Redis keys.
- A room key has 256 bits of CSPRNG entropy and a one-hour TTL.
- Call sessions contain only the two user IDs and ephemeral key material.
- Keys must never be added to logs, error messages, traces, analytics, crash reports, browser storage, or durable database tables.
- Knowledge of a room UUID alone is no longer sufficient to mint a join token; authorization occurs before token generation.
- Responses use the existing `no-store` cache interceptor.

## Verification

Focused coverage includes:

- key entropy shape, TTL and participant binding;
- self-call rejection;
- participant-only key retrieval;
- expired/corrupt/Redis-unavailable fail-closed behavior;
- token minting only after encrypted-session authorization;
- preservation of E2EE during the existing LiveKit degraded-token path;
- frontend propagation of authenticated key material;
- frontend refusal to create/connect a room when key material is absent.

Run the relevant suites with the repository-standard backend and frontend test commands; CI remains the clean-environment authority.

## Rollout

Deploy the backend first, then the frontend. The backend begins returning `e2eeKey` while older clients safely ignore the extra response property. After backend rollout, the new frontend requires that property and therefore never silently downgrades to plaintext media.

A legacy signalling key argument is still accepted by `LivekitService.joinRoom()` for mixed-version incoming-call compatibility, but the authenticated backend key takes precedence.

## Rollback

If rollback is required, roll the frontend back before the backend so a new client is never paired with an API that omits required key material. Redis call-session keys expire automatically within one hour and require no data migration or cleanup. No durable schema change is introduced by this feature.
