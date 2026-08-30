# Conversation starters

Issue #662 adds optional AI-assisted opening prompts to genuinely new one-to-one chats.

## User flow

The `chat/:id` route now renders `ChatRoomPageComponent`, which composes the existing `ChatRoomComponent` with `ConversationStarterPanelComponent` without duplicating chat state or message delivery.

The starter panel is eligible only when all of these conditions are true:

- the chat has finished loading;
- the loaded conversation contains no messages;
- the local composer is still blank;
- the authenticated user belongs to a room with exactly one other member.

Selecting a starter copies the bounded suggestion into the existing chat composer and persists it through the existing draft path. It never sends a message automatically. As soon as the user types their own text or a message exists, the panel is removed from the interaction flow.

Group rooms never request AI starters.

## Backend trust boundary

`POST /api/chat/conversation-starters` remains authenticated by `SupabaseAuthGuard` and covered by the application-wide NestJS throttle of 10 requests per minute. The request DTO accepts only a UUID partner identifier.

`ConversationStarterService` no longer treats that identifier as permission to read an arbitrary profile. Before profile or interest data is read, it verifies:

1. the requested partner is not the authenticated user;
2. neither account blocks the other through `SafetyService`;
3. both users share a current chat room;
4. that room is a direct room rather than a group;
5. the room has exactly those two members;
6. the partner account is not pending deletion;
7. the partner profile is visible to the caller, including the VIP-only visibility rule.

Eligibility is rechecked before every cache read so a later block or privacy change takes effect immediately.

## LLM privacy and cost controls

Only the minimum visible profile context needed to personalise a starter is sent to the configured LLM provider. Profile fields are whitespace/control-character normalised and bounded before prompt construction:

- display name: 80 characters;
- bio: 240 characters;
- native language: 40 characters;
- up to five target languages at 40 characters each;
- up to five interests at 60 characters each.

The prompt explicitly labels profile content as untrusted and instructs the provider not to follow instructions embedded in it. Provider prompts, bios, interests, identifiers, and model responses are not logged by this feature.

Generated suggestions are de-numbered, normalised, deduplicated, capped at three, and limited to 160 characters each. Provider failure degrades to deterministic safe questions rather than blocking chat.

A per-user/per-partner in-memory cache keeps results for 10 minutes, is bounded to 500 entries, and is consulted only after current authorisation is revalidated. Concurrent cache misses for the same user/partner pair share one in-flight LLM request. Together with the global HTTP throttle, reopening a new room cannot repeatedly consume model quota at navigation speed.

## Failure behaviour

Membership, profile, visibility, or safety verification failures fail closed. Storage outages return an error rather than falling back to private or synthetic profile data. LLM failure alone is non-fatal and returns bounded deterministic starter questions.

The Angular panel treats room membership and starter responses as untrusted network data. It rejects non-direct rooms, duplicate member IDs, malformed suggestions, oversized suggestions, and more than three suggestions. Loading and provider/API failures use accessible status/alert regions, and retry is explicit. User-generated suggestions use `dir="auto"` so mixed-direction language content remains readable.

## Verification

Focused backend tests cover blocked users, arbitrary profile probing, hidden profiles, bounded model output, provider fallback, and cache reuse. Frontend tests cover empty versus existing chats, group suppression, loading, failure/retry state, starter selection, draft persistence, and protection against overwriting user-composed text.

Repository verification should include the normal backend and frontend lint/build/unit suites plus the existing E2E, RTL, translation-safe, Spartan/Relay, and design-sync contracts.

## Rollout and rollback

No database migration or external configuration change is required. The route wrapper is additive around the existing chat room and can be rolled back by restoring `chat/:id` to load `ChatRoomComponent` directly. The backend security/cache changes are independently reversible by restoring the prior `ConversationStarterService`; no persisted data requires cleanup.
