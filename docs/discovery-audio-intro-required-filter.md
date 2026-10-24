# Discovery audio-intro required filter

## Product contract

Discovery exposes an **Audio Introduction** checkbox in Global Search. The control is a requirement filter, not a yes/no profile attribute search:

- unchecked: do not constrain results by audio-intro availability;
- checked: only return discovery profiles with a usable audio introduction;
- toggling the checkbox applies the new requirement immediately;
- the normal Search action preserves the same requirement state alongside language and proficiency filters.

The unchecked state is represented as an omitted `has_audio_intro` query parameter rather than `has_audio_intro=false`. This keeps the API contract unambiguous: `true` means “required”; absence means “no requirement”.

## Existing architecture reused

No new database column, API route, or persistence layer is introduced. The feature uses the existing discovery path:

1. `GlobalSearchComponent` emits typed `SearchFilterParams`.
2. `DiscoveryComponent` maps the emitted requirement into its canonical discovery state.
3. `DiscoveryService.findPartners()` serializes `has_audio_intro=true` only when the requirement is active.
4. The authenticated NestJS discovery endpoint validates the query and applies the existing audio-intro predicate.
5. Discovery profiles use the existing `audio_intro_url` field and nonblank-audio-intro database constraints.

The requirement is intentionally session/UI state. It is not written to the user profile and introduces no new personal data.

## Failure and privacy behavior

The filter does not expose audio URLs for profiles that the authenticated discovery query would otherwise be unable to see. Existing discovery authorization, blocked-user filtering, visibility rules, pagination/bounds, and provider failure behavior remain authoritative.

If discovery is unavailable, the existing retryable Discovery error state is used. The filter itself performs no destructive mutation and can be toggled safely after a failed request.

No audio content, URL, user identifier, or filter choice is added to application logs or analytics by this change.

## Accessibility

The control uses the repository-owned Spartan checkbox and an explicitly associated label. It remains keyboard-operable, exposes checked state through the native checkbox semantics, and participates in the existing responsive Global Search layout for narrow screens and high zoom.

## Verification

Focused frontend tests cover:

- checked state emits `has_audio_intro: true`;
- unchecked state omits the requirement instead of requesting profiles without intros;
- toggling on applies immediately;
- toggling off removes the requirement immediately;
- the checkbox retains an associated accessible label;
- the parent Discovery contract maps the requirement into the canonical partner query.

Repository CI remains authoritative for the complete frontend unit/static-analysis/build and governance suite.

## Rollout and rollback

This is a backwards-compatible frontend contract correction with no migration or configuration change. Deploy through the normal frontend release process.

Rollback is a normal code revert. Existing backend support remains compatible with both versions, and no stored data needs cleanup.
