# Profile UI contract

Issue #957 is implemented by the existing Angular `ProfileComponent` and its shared profile primitives. This document records the contract that the focused component regression suite protects.

## Learning identity

The read-only profile summary presents the authenticated profile's native languages, target languages, and current study streak from the `UserProfile` payload. The component must not invent fallback learning metrics when those values are absent or zero. Profile editing continues to use the existing language-picker controls and server-owned entitlement rules for persisted language changes.

## Audio introduction

`ProfileComponent` passes `audio_intro_url` to the shared `AudioIntroRecorderComponent`. That component owns playback, recording, upload, and cleanup behavior. Saving a new introduction updates the in-memory profile only after the recorder reports a completed media URL; no credentials or storage secrets are exposed by the profile surface.

## Loading and failure behavior

Profile loading is asynchronous. The existing skeleton state remains visible while the profile request is pending. A failed profile request leaves the profile unavailable and exposes the translated/error message rather than manufacturing a profile. Visitor loading and visitor errors remain isolated from the main profile request.

## Accessibility and responsive behavior

The profile continues to use native links and Spartan/Relay controls for interactive behavior, semantic text roles for profile statistics, logical spacing utilities for RTL layouts, and mobile-first grid breakpoints. The learning identity and streak remain text-readable and are not communicated by colour alone.

## Verification

`frontend/src/app/components/profile/profile.component.spec.ts` verifies the core #957 contract:

- native and target languages render from the loaded profile;
- the current study streak is visible;
- a persisted audio introduction is bound to the shared audio-intro component;
- existing follower navigation, VIP privacy behavior, and load-failure behavior remain intact.

Repository pull-request CI remains authoritative for frontend unit tests, static analysis, production build, design-system governance, and the wider application checks.

## Rollback

This completion change adds regression coverage and documentation only. Reverting it removes those guards without changing runtime profile data, API contracts, routes, or persisted state.
