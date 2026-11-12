# Product Roadmap

Last reviewed: 12 November 2026

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
  `monetisation/webhooks/google`, both refusing unknown product identifiers. Coin purchases are verified
  with the provider, mapped to a server-owned SKU and processed idempotently before a balance changes.
- Production Angular builds now use deployment-provided runtime configuration. The container validates and
  renders the public Supabase, Centrifugo and LiveKit settings before serving the browser bundle.
- Recent delivery added dedicated groups and scheduled events, 50/50 language-exchange call timers,
  verb-conjugation and IPA trainers, LLM prompt-injection guarding, PII scrubbing before AI providers, chat
  link previews, corrector scores, hobby tags, dynamic font scaling, a sticker store, a privacy settings hub
  and developer-tier API keys and analytics.
- Four defect classes remain open and are tracked below: live NestJS code queries tables that no replayed
  migration creates, several implementations exist that no module registers and no route serves, the mounted
  calls API accepts an anonymous fallback identity, and notification preferences are split across three
  incompatible endpoints.

## Next priorities

| Priority | Work                                                             | Completion signal                                                                                                                                                       |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Authenticate the calls API                                       | `CallsController` mounts `SupabaseAuthGuard`, every handler derives identity from `@CurrentUser`, no `dummy_caller_id` fallback remains, and a controller spec plus an e2e test prove anonymous requests return 401. |
| P0       | Create every table that live NestJS code queries                 | A clean replay of `supabase/migrations` plus the compatibility shims yields `user_push_tokens`, `xp_events`, `groups`, `group_members`, `group_announcements`, `group_resources`, `communities`, `interests`, `language_islands`, `language_island_members`, `resource_library`, `status_views`, `translations`, `user_statistics`, `escrow_crash_reports` and `reading_engine_crash_reports`; `corrector_ratings` now exists. |
| P0       | Collapse the two mounted Stripe subscription webhooks            | Exactly one Stripe webhook route is mounted, and every provider event that mutates VIP state is signature-verified and idempotent.                                         |
| P0       | Add sign-in and registration routes and guard authenticated pages | `/login` and `/register` render components wired to `AuthService`, a functional `authGuard` redirects signed-out users with a return URL, protected route groups use it, and `SocialLoginButtonsComponent` is used or deleted. |
| P0       | Unify the notification preference APIs                           | One contract shape is served by one mounted endpoint; the three current routes (`/notification-preferences`, `/notifications/preferences`, `/users/me/notification-preferences`) are reduced to it and the Angular client uses only that contract. |
| P0       | Restore the API-first frontend boundary                          | Angular uses Supabase only for authentication and file uploads. Profile, streak, status, linked-account and visitor operations use authenticated NestJS endpoints and R2 upload contracts. |
| P1       | Mount and secure cloud chat backups                              | The backup module is reachable, uses the real `room_id` schema, authorises channel membership and validates bounded import payloads.                                   |
| P1       | Complete chat location sharing                                   | The missing schema, chat payload, authorised realtime update and Angular map card are delivered as one tested feature slice.                                            |
| P1       | Use the real pronunciation scorer everywhere                     | The feedback component calls the real NLP scorer, the duplicate `pronunciation` module is deleted, and an Azure outage returns an error rather than a fabricated score.  |
| P1       | Replace placeholder contact sharing                              | `UsersService.shareContact` stops returning a fixed phone number and email; only explicitly consented, verified sender fields are shared with an authorised conversation partner. |
| P1       | Remove orphaned implementations                                  | The duplicate feed services, the unused `SocialLoginButtonsComponent`, `ContentSecurityModule`, `CuratedContentModule`, `CulturalInsightsModule`, `AssessmentsModule` and the legacy `NotificationPreferencesModule` are mounted or deleted, and a guard fails when dead code returns. |
| P1       | Cover the mounted backend modules that have no tests             | `help`, `language-islands`, `proficiency`, `resource-library` and `spam-detection` each ship a service and a controller spec; `calls` adds a controller spec covering 401 and every route. |
| P1       | Cover the untested Angular surfaces                              | Subscription, account deletion, authentication, profile edit and customisation components each ship a spec.                                                             |
| P1       | Ship the Developer-tier custom educational bots                  | A developer tier subscriber can create a bot, talk to it and manage it, and the bot survives a clean database replay.                                                      |
| P1       | Localise backend-generated notification and chat text            | Push notification titles, bodies and system chat messages resolve through `I18nService` using the recipient's locale.                                                    |
| P2       | Complete push-token registration and revocation                  | Browser FCM permission, token persistence, logout revocation and invalid-token pruning work through the NestJS API.                                                     |
| P2       | Finish localisation of navigation metadata and surfaced literals | Route titles, placeholders, alternative text and ARIA labels resolve through translation keys and update when the UI language changes.                                  |
| P2       | Replace the remaining chat-list not-implemented stubs            | No control on the chat list raises a not-implemented toast, and each of the four controls performs its named action.                                                    |
| P2       | Guard unmounted modules and unrouted API paths                   | A verification script fails the build when a NestJS module is not registered or an Angular service calls a path that no mounted controller serves.                        |

The implementation-ready issue descriptions for this review are emitted in `.factory-architect.json`.
