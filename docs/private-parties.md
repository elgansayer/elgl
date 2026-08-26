# Private Parties

Private Parties are the invite-only audio-room mode tracked by issue #1315. The feature reuses the existing authenticated audio-room, LiveKit and Centrifugo stack rather than creating a second realtime system.

## Product contract

Only an authenticated VIP/Pro account may create a private room. The backend is authoritative for that entitlement check. The creation UI lets the host choose a room title, language pair, topic, optional video mode and one or more accounts from the host's current Following list.

The browser submits only user IDs for invitees. The API accepts a non-empty list of at most 50 unique UUID v4 identifiers. Malformed, duplicate or oversized invitation lists fail validation before room creation is attempted. The frontend also refuses to submit while the following list is loading, unavailable, or contains a selected ID that is no longer present in the latest loaded list.

Private rooms remain excluded from the public active-room listing and the unauthenticated room preview. The authenticated private-room collection is bounded to 50 active rooms and includes rooms hosted by or explicitly inviting the caller. LiveKit token minting rejects users who are neither the host nor an invited user.

## Failure behaviour

The friend directory is an authoritative input to invitation selection. A directory failure is not presented as an empty friends list: the modal exposes an error and Retry action, clears stale selections, and keeps Create disabled until a successful reload. A successful reload removes selections for accounts that are no longer in the returned Following list.

Backend DTO validation rejects empty, malformed, duplicate, or more-than-50 invite lists. Existing audio-room creation, private-room persistence, token generation and room-list failures continue through their established service boundaries; the client must not fabricate a private room or invitation state after a failed request.

## Security and privacy

- VIP/Pro eligibility is checked server-side when creating a private room.
- Private room join tokens are restricted to the host and invited user IDs.
- Private rooms do not appear in public room listings or public SSR previews.
- Invite selection is bounded to the authenticated host's Following list in the first-party UI.
- Invitation payloads contain user IDs only; the feature does not persist the browser's friend-search text.
- Credentials, LiveKit secrets and access tokens are never part of the invitation payload.

The API-level UUID, uniqueness and size constraints are required even though the first-party UI selects known users, because HTTP payloads are untrusted input.

## Accessibility and responsive behaviour

The modal uses the repository's Spartan inputs, selects, checkboxes and buttons. Friend loading is exposed as status state, load failure is exposed as an alert with a keyboard-accessible retry action, and the Create action remains disabled until the invitation contract is valid. Existing scroll bounds keep the invitee list usable on narrow and high-zoom viewports.

## Verification

Automated coverage includes:

- private-party DTO acceptance of valid invite IDs;
- empty, malformed, duplicate and oversized invite rejection;
- following-list load and selection behavior;
- fail-closed invitation form behavior during directory outages;
- retry recovery and stale-selection removal;
- final create payload composition.

Canonical repository CI remains authoritative for backend/frontend unit suites, lint/static analysis, builds, dependency review and broader audio-room integration checks.

## Rollout and rollback

No schema migration or data backfill is required. Deploying the backend validation before or with the frontend is backward compatible with valid existing clients. A rollback is a normal application revert; existing private rooms and invitation data do not require cleanup.
