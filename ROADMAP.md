# Product Roadmap

Last reviewed: 5 November 2026

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
- Mobile subscription webhooks are now single-path: one verified Apple App Store handler at
  `monetisation/webhooks/apple` and one verified Google Play Pub/Sub handler at
  `monetisation/webhooks/google`, both refusing unknown product identifiers.
- Three defect classes remain open and are tracked below: the production Angular bundle is compiled from the
  mock environment file, live NestJS code queries tables that no replayed migration creates, and several
  implementations exist that no module registers and no route serves.

## Next priorities

| Priority | Work                                                             | Completion signal                                                                                                                                                       |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Ship a real production environment to the Angular bundle        | The production configuration replaces the mock environment file, no build output contains `mock.supabase.co` or `127.0.0.1:3000`, and the container resolves the API and realtime origins at deploy time. |
| P0       | Mount and contract-align the notification preferences API        | `NotificationPreferencesModule` is registered, `GET` and `PUT /api/notification-preferences` respond, and the Angular client and backend agree on one preference shape.                |
| P0       | Create every table that live NestJS code queries                | A clean replay of `supabase/migrations` plus the compatibility shims yields a schema containing `user_push_tokens`, `xp_events`, `corrector_ratings`, `communities`, `groups`, `group_members`, `group_announcements`, `group_resources`, `interests`, `language_islands`, `language_island_members`, `resource_library`, `status_views`, `translations`, `user_statistics`, `escrow_crash_reports` and `reading_engine_crash_reports`. |
| P0       | Collapse the two mounted Stripe subscription webhooks            | Exactly one Stripe webhook route is mounted, and every provider event that mutates VIP state is signature-verified and idempotent.                                         |
| P0       | Fail closed for unauthenticated Angular sessions                 | A missing or signed-out Supabase session cannot become a mock authenticated user outside explicit local demo mode, and protected routes redirect to authentication.     |
| P0       | Restore the API-first frontend boundary                          | Angular uses Supabase only for authentication. Profile, streak, status, linked-account and media operations use authenticated NestJS endpoints and R2 upload contracts. |
| P0       | Verify every mobile coin purchase                                | Apple, Google and Stripe receipts are checked with their provider, mapped to a server-owned SKU and processed idempotently before any balance mutation.                 |
| P1       | Mount and secure cloud chat backups                              | The backup module is reachable, uses the real `room_id` schema, authorises membership and validates bounded import payloads.                                            |
| P1       | Complete chat location sharing                                   | The missing schema, chat payload, authorised realtime update and Angular map card are delivered as one tested feature slice.                                            |
| P1       | Use the real pronunciation scorer everywhere                     | The feedback page no longer calls a duplicate endpoint that fabricates scores when Azure is absent or fails.                                                            |
| P1       | Replace placeholder contact sharing                              | Only the authenticated sender's verified, explicitly selected contact fields can be shared with an authorised conversation partner.                                     |
| P1       | Remove orphaned implementations                                   | The duplicate feed service on both sides, the three unmounted backend modules and the stray declaration file are deleted, and a guard fails when dead code returns.            |
| P1       | Cover the mounted backend modules that have no tests             | `help`, `language-islands`, `proficiency`, `resource-library` and `spam-detection` each ship a service and a controller spec.                                             |
| P1       | Cover the untested Angular surfaces                              | The subscription, account deletion, authentication, profile edit and customisation components each ship a spec.                                                         |
| P1       | Ship the Developer-tier custom educational bots                  | A developer tier subscriber can create a bot, talk to it and manage it, and the bot survives a clean database replay.                                                      |
| P2       | Complete push-token registration and revocation                  | Browser FCM permission, token persistence, logout revocation and invalid-token pruning work through the NestJS API.                                                     |
| P2       | Finish localisation of navigation metadata and surfaced literals | Route titles, placeholders, alternative text and ARIA labels resolve through translation keys and update when the UI language changes.                                  |
| P2       | Replace the remaining chat-list not-implemented stubs            | No control on the chat list raises a not-implemented toast, and each of the four controls performs its named action.                                                    |
| P2       | Guard unmounted modules and unrouted API paths                   | A verification script fails the build when a NestJS module is not registered or an Angular service calls a path that no mounted controller serves.                        |

The implementation-ready issue descriptions for this review are emitted in `.factory-architect.json`.
