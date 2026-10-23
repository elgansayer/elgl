# Product Roadmap

Last reviewed: 22 September 2026

This roadmap records the implementation state visible in the repository. It is intentionally narrower than
`FEATURES_SPEC.md`: the issue backlog remains the detailed delivery queue.

## Current state

- The platform stack is established and wired: Angular 22, NestJS, Supabase/PostgreSQL, Redis, Centrifugo,
  LiveKit and Cloudflare R2 all have application modules or deployment configuration.
- Core messaging includes persisted real-time text, voice notes, corrections, doodles, media, replies,
  reactions, read receipts, typing events, search, favourites, direct conversations and group chat surfaces.
- Moments supports feed filters, corrections, translation, text-to-speech, pinning, up to nine images and
  60-second voice posts.
- Discovery includes language and profile filters, serious-learner ranking, presence-aware recommendations and
  PostGIS proximity search with privacy controls.
- The learning stack includes `Intl.Segmenter` tokenisation, word definitions, vocabulary state, flashcards,
  SRS review, audio-synchronised reading, grammar tools, transcription and a provider-backed pronunciation
  scoring service.
- LiveKit audio rooms include join tokens, host and speaker roles, raise-hand approval, co-host management,
  captions, room chat and recording/replay infrastructure.
- VIP plans, developer access, virtual gifts, coin balances, trust and safety, privacy settings, visitor logs,
  moderation and admin surfaces are present, with broad unit-test coverage and focused end-to-end flows.

## Next priorities

| Priority | Work                                                             | Completion signal                                                                                                                                                       |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Fail closed for unauthenticated Angular sessions                 | A missing or signed-out Supabase session cannot become a mock authenticated user outside explicit local demo mode, and protected routes redirect to authentication.     |
| P0       | Restore the API-first frontend boundary                          | Angular uses Supabase only for authentication. Profile, streak, status, linked-account and media operations use authenticated NestJS endpoints and R2 upload contracts. |
| P0       | Verify every mobile coin purchase                                | Apple, Google and Stripe receipts are checked with their provider, mapped to a server-owned SKU and processed idempotently before any balance mutation.                 |
| P0       | Remove duplicate mobile subscription webhook routes              | Exactly one verified Apple handler and one verified Google handler are mounted, with no placeholder user or tier path.                                                  |
| P1       | Mount and secure cloud chat backups                              | The backup module is reachable, uses the real `room_id` schema, authorises membership and validates bounded import payloads.                                            |
| P1       | Complete chat location sharing                                   | The missing schema, chat payload, authorised realtime update and Angular map card are delivered as one tested feature slice.                                            |
| P1       | Use the real pronunciation scorer everywhere                     | The feedback page no longer calls a duplicate endpoint that fabricates scores when Azure is absent or fails.                                                            |
| P1       | Replace placeholder contact sharing                              | Only the authenticated sender's verified, explicitly selected contact fields can be shared with an authorised conversation partner.                                     |
| P2       | Complete push-token registration and revocation                  | Browser FCM permission, token persistence, logout revocation and invalid-token pruning work through the NestJS API.                                                     |
| P2       | Finish localisation of navigation metadata and surfaced literals | Route titles, placeholders, alternative text and ARIA labels resolve through translation keys and update when the UI language changes.                                  |

The implementation-ready issue descriptions for this review are emitted in `.factory-architect.json`.
