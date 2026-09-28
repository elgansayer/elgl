# Audio Room UI contract

Issue #1357 is implemented by the existing standalone Angular `AudioRoomComponent`, `AudioRoomsStore`, and `audio-room-view-model` boundary. This document records the production contract so future room work does not regress the Host, Speaker Stage, or Listener Audience surfaces.

## Product contract

When no room is selected, the component shows the room discovery surface. After joining a room, the selected-room header identifies the host and the stage view model renders the host exactly once even when an older or mixed-version room snapshot omits the host from its speaker list.

The Speaker Stage is ordered host, co-host, then remaining speakers. Live speaking and mute state are preserved by user ID. Rendering is bounded to 24 participant cards and reports any remaining count rather than allocating an unbounded DOM tree.

The Listener Audience uses the authoritative listener count from stage/room state. The current stage API does not expose listener profiles, so the UI intentionally renders at most eight anonymous listener seats and summarizes the remainder. It must not manufacture names, avatars, or identities from a count. API counters are normalized and capped before DOM allocation.

## Accessibility and responsive behavior

Speaker and listener collections expose list/listitem semantics with translated accessible names and status counts. Important room actions use repository-owned Spartan or Relay controls and translated labels. Speaking/muted/host/co-host state must not rely on colour alone.

The room remains mobile-first: content stacks at narrow widths, the main room/sidebar composition moves to three columns at `lg`, and the speaker stage progressively expands from two to three to four columns. New layout work must continue to use logical RTL-safe properties and must reflow without horizontal page scrolling at high zoom.

## Data, privacy, and failure behavior

Host and speaker identities come only from authenticated backend room/stage data. Listener identities remain undisclosed until an explicit authenticated API contract supplies them. Do not infer listener profiles from ordering, counts, display names, LiveKit internals, or other client metadata.

The existing `AudioRoomsStore` remains the owner of room loading, stage state, LiveKit/Centrifugo connections, moderation actions, and degraded-mode behavior. This contract does not add a schema, persistence model, or alternate realtime path.

## Verification

Run the focused structural contract from the repository root:

```bash
node --test scripts/verify-audio-room-ui-contract.test.mjs
```

The check verifies host display, bounded/deduplicated stage ownership, privacy-preserving listener rendering, responsive composition, and accessible Spartan/Relay action ownership. Pull requests changing the audio-room component, view model, or room store run the same check in `Audio Room UI Contract`.

Normal frontend static analysis, production build, component tests, design-governance checks, and repository CI remain authoritative for broader integration behavior.

## Rollout and rollback

This completion adds verification/documentation only because the required production UI already exists on `main`. There is no data migration, API change, feature flag, or runtime rollout. Rollback is a normal revert of the contract files; it must not be used to justify removing host/stage/audience behavior or replacing privacy-preserving listener seats with fabricated identities.
