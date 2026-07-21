# TODO.md (The Granular Execution Checklist)

## Phase 1: Repository Setup & Infrastructure Initialisation
- [x] Initialise NestJS backend (`nest new backend --package-manager npm`).
- [x] Initialise Angular frontend (`ng new frontend --style=scss --routing=true --ssr=false`).
- [x] Install and configure Tailwind CSS in the Angular project (`tailwind.config.js` & `styles.scss`) using strictly logical properties (`ps-`, `pe-`, `ms-`, `me-`).
- [x] Create Docker Compose orchestration configuration (`docker-compose.yml` & `docker-compose.dev.yml`) orchestrating `api` (NestJS), `web` (Angular), `cache` (Redis 7), `websocket` (Centrifugo v5), and `sfu` (LiveKit v2).
- [x] Create comprehensive `.env.example` and setup NestJS `@nestjs/config` environment schema validation (`Joi`/`Zod`) to fail-fast on missing keys or malformed URLs.
- [x] Create Supabase SQL migration (`001_initial_schema.sql`) for `users` table with PostGIS geography columns, `is_vip`, `coins_balance`, `study_streak_days`, and `correction_ratio`.
- [x] Create Supabase SQL migration (`002_trust_and_safety.sql`) for `profile_visits`, `blocks`, and `reports` tables.
- [x] Implement Supabase JWT email/password and OAuth authentication service in Angular (`AuthService`).
- [x] Create NestJS `SupabaseAuthGuard` and `CurrentUser` decorator to validate Supabase JWTs on all REST and WebSocket endpoints.
- [x] Verify clean linting across both projects (`npm run lint`).

## Phase 2: User Profiles, PostGIS Matchmaking & Visitor Tracking
- [x] Create NestJS `UsersController` & `UsersService` to handle profile updates (bio, native language, target languages up to 3 for VIP, privacy toggles).
- [x] Configure Cloudflare R2 SDK (`@aws-sdk/client-s3`) in NestJS `MediaModule`. Create pre-signed URL upload endpoints for avatars and audio intros.
- [x] Build NestJS `DiscoveryController` PostGIS matching algorithm: Find users within customizable radius (`ST_DWithin`).
- [x] Implement VIP location spoofing logic in `DiscoveryService` (override real GPS coordinates with `mock_location` when `is_vip === true`).
- [x] Build algorithmic "Serious Learner" filtering in discovery (`study_streak_days > 7` and `correction_ratio >= 0.8`).
- [x] Build NestJS `ProfileVisitsService` to record profile views and query visitor logs (`GET /users/:id/visitors`).
- [x] Build Angular Profile UI (`ProfileComponent`) with native/target language badges, audio intro player, and study streak display.
- [x] Build Angular "Who Viewed Me" component (`VisitorLogsComponent`): blur visitor avatars and names if user is on the free tier (`is_vip === false`), showing upgrade prompt for 8 UKP / $10 USD.
- [x] Build Angular Matchmaking & Discovery UI (`DiscoveryComponent`) with distance slider, language filters, and "Serious Learner" toggle.

## Phase 3: Centrifugo Real-Time Chat Engine & Interactive Payloads
- [x] Setup Centrifugo server configuration (`config.json`) and connect to Redis instance for pub/sub.
- [x] Build NestJS `ChatController` endpoint (`POST /chat/token`) to mint Centrifugo connection JWTs with user sub claims.
- [x] Install `centrifuge-js` in Angular and build a resilient global `CentrifugeService` with reconnection and connection state signals.
- [x] Create Supabase SQL migration (`003_chat_and_favourites.sql`) for `chat_messages` and `favourites` tables.
- [x] Build NestJS endpoint `POST /chat/messages` to validate messages, persist to Supabase `chat_messages` table, and publish to Centrifugo via HTTP API (`/api/publish`).
- [x] Build Angular 1-on-1 and Group Chat UI (`ChatRoomComponent`) with real-time message stream, typing indicators, and read receipts.
- [x] Implement custom JSON diff rendering (`VisualDiffComponent`) in Angular for language corrections (red strikethrough for original, green for fixed text).
- [x] Build HTML5 Canvas Doodle Tool component (`DoodlePadComponent`) in Angular allowing users to draw and transmit visual explanations.
- [x] Build hold-to-record voice note recorder (`VoiceRecorderComponent`) in Angular with Cloudflare R2 direct upload and inline audio playback.
- [x] Build Favourites bookmarking functionality: `POST /chat/favourites` in NestJS and `FavouritesComponent` in Angular to review saved messages and corrections.
- [x] Implement client-side and server-side (`pg_trgm`) message search inside chat rooms.

## Phase 4: LingQ Interactive Reading Engine & AI/NLP Utilities
- [ ] Create Supabase SQL migration (`004_flashcards_srs.sql`) for `flashcards` table indexed by `user_id` and `word_token`.
- [ ] Build the core `TokenisedTextComponent` in Angular using native `Intl.Segmenter` API (`granularity: 'word'`) to render clickable tokens.
- [ ] Create Angular Signals vocabulary store (`VocabularyStore`) tracking word tokens mapped to SRS levels (`0`=Blue, `1` to `3`=Yellow, `4`=White).
- [ ] Build click-to-translate & define pop-up modal (`WordDefinitionModalComponent`) in Angular with dictionary definitions and pronunciation audio.
- [ ] Build NestJS `NlpModule` routing translation and transliteration requests to Azure AI / DeepL.
- [ ] Implement daily AI usage rate limiting in Redis (`daily_ai_usage:{user_id}:{date}`): cap at 10 requests/day for free users, unlimited for VIP (8 UKP / $10 USD per month).
- [ ] Build NestJS `FlashcardsController` endpoints (`POST /flashcards`, `PATCH /flashcards/:id/srs`) to save words and update review schedules.
- [ ] Build Angular SRS Vocabulary Review Dashboard (`VocabularyDashboardComponent`) with flashcard flip animations and review grading.
- [ ] Build AI Grammar Checker pre-send utility (`POST /nlp/grammar-check`) flagging sentence errors before sending in chat or moments.
- [ ] Build AI Pronunciation Scoring service (`POST /nlp/pronunciation-score`) grading spoken audio out of 100 with phonetic breakdown.

## Phase 5: Global Social Feed ("Moments") with Redis Fan-Out
- [ ] Create Supabase SQL migration (`005_moments.sql`) for `moments`, `moment_comments`, and `moment_likes` tables.
- [ ] Build NestJS background worker (`TimelineWorker`) connected to Redis for fan-out processing (`RPUSH timeline_queue:{follower_id}`).
- [ ] Build NestJS `MomentsController` (`POST /moments` for creation, `GET /moments/feed` fetching IDs from Redis then hydrating from Supabase).
- [ ] Build filtering endpoints for Moments feed: `"All"`, `"Classmates"` (same target language), and `"Following"`.
- [ ] Build Angular Social Feed UI (`MomentsFeedComponent`) with multi-modal rendering (text, up to 9 images, 60s voice clips).
- [ ] Integrate `VisualDiffComponent` into moment comments section, allowing community corrections directly on public timeline posts.
- [ ] Build one-tap Moment audio reading (`TextToSpeechComponent`) and inline Moment translation.
- [ ] Build Moment pinning functionality for VIP users (`PATCH /moments/:id/pin`).

## Phase 6: Live Audio & Video Rooms (LiveKit SFU)
- [ ] Install `livekit-server-sdk` in NestJS `AudioRoomsModule` and configure `RoomServiceClient`.
- [ ] Build NestJS endpoint (`POST /audio-rooms/create`) to initialize LiveKit room and store metadata in `audio_rooms` table.
- [ ] Build NestJS access token generation endpoint (`POST /audio-rooms/token`) granting default `roomJoin: true`, `canPublish: false` for listeners.
- [ ] Install `@livekit/components-angular` or native `livekit-client` in Angular frontend.
- [ ] Build Angular Audio/Video Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- [ ] Implement Stage Management API & UI:
    - Listener clicks "Raise Hand" (`POST /audio-rooms/raise-hand`).
    - Host approves request (`POST /audio-rooms/approve-speaker`).
    - NestJS issues refreshed LiveKit JWT with `canPublish: true`.
- [ ] Build synchronised text chat overlay (`RoomChatComponent`) inside live rooms powered by Centrifugo (`room_{id}` channel).
- [ ] Implement real-time AI speech-to-text subtitles broadcasting closed captions into live rooms.
- [ ] Build stream recording & replay archive storage (`POST /audio-rooms/archive`) saving LiveKit composite recordings to Cloudflare R2.

## Phase 7: VIP Monetisation, Virtual Economy, Trust/Safety & 24/7 VPS Deployment
- [ ] Build NestJS `MonetisationController` handling Stripe & Apple/Google App Store webhooks (`POST /webhooks/stripe`) to toggle `user.is_vip` and `vip_tier`.
- [ ] Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent): unlimited AI, 3 target languages, location spoofing, incognito profile views.
- [ ] Build virtual coin store & purchasing endpoints (`POST /economy/purchase-coins`) adding balance to `users.coins_balance`.
- [ ] Build Virtual Gift catalog & sending endpoint (`POST /economy/send-gift`), deducting coins and publishing animated Centrifugo broadcast events.
- [ ] Build Audio Room tipping mechanism allowing listeners to gift coins directly to hosts on stage.
- [ ] Build Developer Tier (20 UKP / $26 USD per month) API key management and developer analytics dashboard.
- [ ] Build Trust & Safety reporting system (`POST /safety/report`, `POST /safety/block`), automatically hiding blocked users from feeds and chat lists.
- [ ] Create production Docker orchestration (`docker-compose.prod.yml`) with Nginx reverse proxy routing (`/api` -> `api:3000`, `/centrifugo` -> `websocket:8000`, `/` -> `web:80`).
- [ ] Verify LiveKit SFU port forwarding (`7880/tcp`, `7881/tcp`, `50000-60000/udp`) and external IP configuration (`use_external_ip: true`) for 24/7 cloud VPS deployment.
- [ ] Conduct final end-to-end linting (`npm run lint`), TypeScript compilation (`tsc --noEmit`), Docker container build & health verification (`docker compose up --build -d`), and RTL layout check across all components.
