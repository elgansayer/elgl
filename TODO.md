# TODO.md (The Granular Execution Checklist)

## Phase 1: Repository Setup & Supabase Initialisation
- [ ] Initialise NestJS backend (`nest new backend`).
- [ ] Initialise Angular frontend (`ng new frontend --style=scss`).
- [ ] Install and configure Tailwind CSS in the Angular project using strictly logical properties.
- [ ] Create Supabase SQL migration for `users` table with PostGIS geography columns.
- [ ] Implement Supabase JWT email/password authentication in Angular.
- [ ] Create NestJS Auth Guard to validate Supabase JWTs on all API routes.

## Phase 2: User Profiles & PostGIS Matchmaking
- [ ] Create NestJS endpoint to handle profile updates (bio, target language, native language).
- [ ] Configure Cloudflare R2 SDK in NestJS. Create an upload endpoint for user avatar photos.
- [ ] Create Supabase SQL migration for `profile_visits` table.
- [ ] Build NestJS PostGIS matching algorithm: Find users within 10 miles.
- [ ] Implement VIP location spoofing logic (Override real GPS if `is_vip` is true).
- [ ] Build Angular Profile UI, including the "Who Viewed Me" component (blur data if not VIP).

## Phase 3: Centrifugo Real-Time Chat Setup
- [ ] Setup Centrifugo configuration file and Redis connection details.
- [ ] Build NestJS endpoint to mint Centrifugo connection JWTs.
- [ ] Install `centrifuge-js` in Angular and build a global WebSocket service.
- [ ] Build NestJS endpoint to handle incoming chat messages, save to Supabase `chat_messages` table, and publish to Centrifugo via HTTP API.
- [ ] Build Angular Chat UI with typing indicators and read receipts.
- [ ] Implement custom JSON diff rendering in Angular for language corrections.

## Phase 4: LingQ Engine & Universal Tokenisation
- [ ] Create Supabase SQL migration for `flashcards` table.
- [ ] Build the `TokenisedTextComponent` in Angular using `Intl.Segmenter`.
- [ ] Create NgRx or Angular Signals global state to hold the user's known vocabulary.
- [ ] Build click-to-translate UI pop-up in Angular.
- [ ] Build NestJS endpoint to route translations to DeepL/Azure AI.
- [ ] Build NestJS endpoint to save a clicked word to the `flashcards` table with SRS level 1.

## Phase 5: Social Feed Fan-Out (Redis)
- [ ] Create Supabase SQL migration for `moments` table.
- [ ] Build NestJS background worker to handle Redis fan-out.
- [ ] Create `/moments` POST endpoint. Save post to DB, push ID to Redis `timeline_queue` for all followers.
- [ ] Build `/feed` GET endpoint. Fetch IDs from Redis, then query Supabase for full post data.
- [ ] Build Angular Social Feed UI, ensuring RTL language mirroring.

## Phase 6: Live Audio Rooms (LiveKit)
- [ ] Install `livekit-server-sdk` (v2) in NestJS.
- [ ] Build NestJS token minting endpoint for Audio Rooms.
- [ ] Install `livekit-client` in Angular.
- [ ] Build Angular Audio Room UI (Speaker Grid, Listener List).
- [ ] Implement Stage Management API (Raise hand, promote to speaker, demote to listener).

## Phase 7: Monetisation & Virtual Economy
- [ ] Add Stripe or App Store billing webhooks to NestJS to toggle the `is_vip` boolean.
- [ ] Enforce the 8 UKP / $10 USD consumer tier (unlimited translations, full profile views).
- [ ] Build virtual gift purchasing endpoint: Add coins to `coins_balance`.
- [ ] Build Audio Room tipping logic: Deduct coins, trigger Centrifugo global animation event.
- [ ] Create API key generation system for the Developer tier (20 UKP / $26 USD per month).
