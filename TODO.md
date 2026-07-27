# TODO.md (Master HelloTalk Clone Architecture: Phases 1 to 79 + Phase C)

## URGENT

- [STUCK] Fix QA test failure: `TS2307: Cannot find module '../../../environments/environment' or its corresponding type declarations.` in `frontend/src/app/services/faq.service.ts:4` and `frontend/src/app/services/moderation.service.ts:5` (per `qa_errors.log`). Both files sit at `frontend/src/app/services/` but use a 3-level-up relative import (`../../../environments/environment`), whereas every sibling service in that same directory (e.g. `notification.service.ts`, `user.service.ts`, `chat.service.ts`) correctly uses 2 levels up (`../../environments/environment`) to reach `frontend/src/environments/environment.ts`. Fix: correct both imports to `../../environments/environment`.
- [x] Fix QA test failure: `ReferenceError: describe is not defined` (recurred again). Root cause of this second recurrence: the previous fix below (truncating `qa_errors.log` each cycle) was only ever written up in this TODO entry, it was never actually committed to `qa-loop.sh` (`git log -p -- qa-loop.sh` shows only the `cd frontend` to `cd e2e` change landed, no `> qa_errors.log` line). So the log kept growing unbounded again (16.5k+ lines) and the triage grep kept re-matching the same months-old stale `describe is not defined` entry at the top of the file regardless of what actually failed. Fixed by actually adding `> qa_errors.log` truncation at the top of the loop in `qa-loop.sh` (alongside the existing `> qa_aider.log`), and cleared the stale accumulated log. Restarted the live `qa-loop.sh` process (via its tmux `QA_Swarm` window) so the fix takes effect, since bash caches the parsed loop body in memory for the life of the process.
- [x] Investigated the claimed "third recurrence" (`qa-loop.sh` truncation line allegedly unstaged again). This premise was stale/false by the time it was actioned: `git diff -- qa-loop.sh` and `git diff --cached -- qa-loop.sh` were both empty, and `git blame` confirmed the `> qa_errors.log` line was already committed in `a694af4` ("feat: add error log file for QA loop", 2026-07-26 22:11:16), so there was nothing to stage or commit. The real, still-live bug was the other half of the same warning: the tmux `QA_Swarm` window's `qa-loop.sh` process (PID 583073) had started at 22:07, four minutes _before_ commit `a694af4` landed, so it was still running on the old cached loop body without the truncation line (bash caches the parsed loop body in memory for the life of the process). It would have kept appending to `qa_errors.log` unbounded despite the file on disk being fixed. Restarted the process (new `QA_Swarm` tmux window, `qa-loop.sh` relaunched at 22:13, after the commit) so the already-committed fix actually takes effect. Lesson for future cycles: verify `git diff`/`git log` state fresh each time rather than trusting a prior TODO entry's claim, since the entry itself can go stale between being written and being actioned.
- [x] Fix QA test failure: `ReferenceError: describe is not defined`.
- [x] Fix QA test failure: `Error: Process from config.webServer was not able to start. Exit code: 143`. Root cause: `e2e/playwright.config.ts` `webServer` runs `cd ../frontend && npm run start` (Angular dev server), which never reaches a successful compile because the frontend currently has real TypeScript build errors, so `ng serve` keeps failing/restarting until Playwright's 120s `webServer.timeout` elapses and it force-kills (SIGTERM, exit 143) the still-uncompiled process. Fixed both compile errors:
  1. `frontend/src/app/components/hobby-tags/hobby-tags.component.ts`: `userVocabulary` signal retyped from `unknown[]` to the service's real `VocabularyItem[]` interface (`word`, `translation`, `hobbyTagName`); template updated to only reference fields that actually exist on it, and the now-unused `getDifficultyColour` helper was removed.
  2. `frontend/src/app/components/virtual-gift-modal/virtual-gift-modal.component.ts`: added the missing `TranslatePipe` to the standalone component's `imports` array, resolving `NG8004: No pipe found with name 't'`.
     Verified: `cd frontend && npm run build` completes with no errors, and `ng serve` reaches "Application bundle generation complete" well inside Playwright's 120s `webServer.timeout`.
- [x] Fix QA test failure: `ReferenceError: describe is not defined` (recurred again during latest QA run). Root cause of the _recurrence_ was not the original bug reappearing: `qa-loop.sh` already correctly runs `(cd e2e && npx playwright test)`, verified clean (`npx playwright test --list` finds 100 tests across 14 files, no describe/vitest errors). The real bug was in `qa-loop.sh`'s triage step: `qa_errors.log` was opened with `>>` and never truncated between cycles, so it grew to 31MB+. The triage line `grep -E -A 5 "Error:|failed" qa_errors.log | head -n 1` always matched the _first_ error in the file, i.e. the original stale `ReferenceError: describe is not defined` recorded before the `e2e/` fix landed, so every later QA cycle (even ones failing for unrelated reasons, e.g. transient EMFILE watcher errors) got misdiagnosed as this same long-fixed bug and re-added to `TODO.md`. Fixed by truncating `qa_errors.log` at the top of each loop iteration (same as `qa_aider.log` already was), and manually cleared the stale accumulated log. Note: the live `qa-loop.sh` process must be restarted to pick up this fix, since bash caches the parsed loop body in memory for the life of the process.

## GLOBAL ARCHITECTURAL RULES

- **RULE 1:** ABSOLUTELY NO HARD-CODED DATA. All content, user profiles, and UI copy must be fetched dynamically or piped through `@ngx-translate`.
- **RULE 2:** STRICT i18n (`@ngx-translate`). No raw text strings allowed inside Angular HTML templates.
- **RULE 3:** PIXEL-PERFECT CLONING. Every UI component must be visually verified against the `original-hello-talk-screenshots/` directory.

---

## Outstanding Blockers

- [STUCK] Build "Report User" modal with dynamic category selection (BLOCKED: missing design spec, screenshots not accessible).

---

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
- [x] Build NestJS endpoint (`POST /chat/token`) to mint Centrifugo connection JWTs with user sub claims.
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

- [x] Create Supabase SQL migration (`004_flashcards_srs.sql`) for `flashcards` table indexed by `user_id` and `word_token`.
- [x] Build the core `TokenisedTextComponent` in Angular using native `Intl.Segmenter` API (`granularity: 'word'`) to render clickable tokens.
- [x] Create Angular Signals vocabulary store (`VocabularyStore`) tracking word tokens mapped to SRS levels (`0`=Blue, `1` to `3`=Yellow, `4`=White).
- [x] Build click-to-translate & define pop-up modal (`WordDefinitionModalComponent`) in Angular with dictionary definitions and pronunciation audio.
- [x] Build NestJS `NlpModule` routing translation and transliteration requests to Azure AI / DeepL.
- [x] Implement daily AI usage rate limiting in Redis (`daily_ai_usage:{user_id}:{date}`): cap at 10 requests/day for free users, unlimited for VIP (8 UKP / $10 USD per month).
- [x] Build NestJS `FlashcardsController` endpoints (`POST /flashcards`, `PATCH /flashcards/:id/srs`) to save words and update review schedules.
- [x] Build Angular SRS Vocabulary Review Dashboard (`VocabularyDashboardComponent`) with flashcard flip animations and review grading.
- [x] Build AI Grammar Checker pre-send utility (`POST /nlp/grammar-check`) flagging sentence errors before sending in chat or moments.
- [x] Build AI Pronunciation Scoring service (`POST /nlp/pronunciation-score`) grading spoken audio out of 100 with phonetic breakdown.

## Phase 5: Global Social Feed ("Moments") with Redis Fan-Out

- [x] Create Supabase SQL migration (`005_moments.sql`) for `moments`, `moment_comments`, and `moment_likes` tables.
- [x] Build NestJS background worker (`TimelineWorker`) connected to Redis for fan-out processing (`RPUSH timeline_queue:{follower_id}`).
- [x] Build NestJS `MomentsController` (`POST /moments` for creation, `GET /moments/feed` fetching IDs from Redis then hydrating from Supabase).
- [x] Build filtering endpoints for Moments feed: `"All"`, `"Classmates"` (same target language), and `"Following"`.
- [x] Build Angular Social Feed UI (`MomentsFeedComponent`) with multi-modal rendering (text, up to 9 images, 60s voice clips).
- [x] Integrate `VisualDiffComponent` into moment comments section, allowing community corrections directly on public timeline posts.
- [x] Build one-tap Moment audio reading (`TextToSpeechComponent`) and inline Moment translation.
- [x] Build Moment pinning functionality for VIP users (`PATCH /moments/:id/pin`).

## Phase 6: Live Audio & Video Rooms (LiveKit SFU)

- [x] Install `livekit-server-sdk` in NestJS `AudioRoomsModule` and configure `RoomServiceClient`.
- [x] Build NestJS endpoint (`POST /audio-rooms/create`) to initialize LiveKit room and store metadata in `audio_rooms` table.
- [x] Build NestJS access token generation endpoint (`POST /audio-rooms/token`) granting default `roomJoin: true`, `canPublish: false` for listeners.
- [x] Install `@livekit/components-angular` or native `livekit-client` in Angular frontend.
- [x] Build Angular Audio Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- [x] Implement Stage Management API & UI:
  - Listener clicks "Raise Hand" (`POST /audio-rooms/raise-hand`).
  - Host receives notification and calls `POST /audio-rooms/approve-speaker`.
  - NestJS calls `AccessToken` API to issue refreshed JWT with `canPublish: true`.
- [x] Build synchronised text chat overlay (`RoomChatComponent`) inside live rooms powered by Centrifugo (`room_{id}` channel).
- [x] Implement real-time AI speech-to-text subtitles broadcasting closed captions into live rooms.
- [x] Build stream recording & replay archive storage (`POST /audio-rooms/archive`) saving LiveKit composite recordings to Cloudflare R2.

## Phase 7: VIP Monetisation, Virtual Economy & Trust/Safety

- [x] Build NestJS `MonetisationController` handling Stripe & App Store webhooks (`POST /webhooks/stripe`) to toggle `user.is_vip` and `vip_tier`.
- [x] Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 annual equivalent): unlimited AI, 3 target languages, location spoofing, incognito profile views.
- [STUCK] Build virtual coin store & purchasing endpoints (`POST /economy/purchase-coins`) adding balance to `users.coins_balance`. (Requires receipt validation to prevent infinite coin exploit).
- [x] Build Virtual Gift catalog & sending endpoint (`POST /economy/send-gift`), deducting coins and publishing animated Centrifugo broadcast events.
- [x] Build Audio Room tipping mechanism allowing listeners to gift coins directly to hosts on stage.
- [x] Build Developer Tier (20 UKP / $26 USD per month) API key management and developer analytics dashboard.
- [x] Build Trust & Safety reporting system (`POST /safety/report`, `POST /safety/block`), automatically hiding blocked users from feeds and chat lists.

## Phase 8: Audit Remediation & Security Lockdown

- [STUCK] Verify Stripe webhook signatures (`stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`) in `MonetisationService#handleStripeWebhook`.
- [STUCK] Lock down `POST /monetisation/upgrade` so VIP status can only change via verified payment webhooks.
- [STUCK] Rework `POST /economy/purchase-coins` to verify purchase receipt records server-side before updating balances.
- [STUCK] Implement Apple App Store Server Notifications and Google Play Billing webhook handlers.
- [STUCK] Replace mock returns in `backend/src/nlp/nlp.service.ts` with real DeepL and Azure AI API calls.

## Phase 9: Internationalisation (i18n) Foundation

- [x] Install `@ngx-translate/core` and `@ngx-translate/http-loader` in Angular.
- [x] Create `en.json` and `ja.json` translation files in `assets/i18n/`.
- [x] Refactor all Angular components to replace raw strings with `{{ 'KEY' | translate }}` pipes.
- [x] Build a Language Selector toggle in settings to dynamically switch UI language.

## Phase 10: The Moments Engine (Feed & Media)

- [x] Analyse Moments feed screenshots in `original-hello-talk-screenshots/`.
- [x] Build Moments Feed UI with infinite scrolling (15 posts per batch).
- [x] Build multi-media attachments UI: text, up to 9 static images in CSS grid, or a 60s voice note.
- [x] Build Audio Player component with waveform visualizer, play/pause, and timestamp tracker.
- [x] Integrate `VisualDiffComponent` into Moments comment section for corrections.

## Phase 11: In-App NLP & Learning Utilities

- [x] Analyse chat context menu screenshots in `original-hello-talk-screenshots/`.
- [x] Build in-line Message Context Menu: Translate, Transliterate, Speak, and Correct.
- [x] Implement Transliteration UI (render Romaji/Pinyin below text in small grey font).
- [x] Implement Text-to-Speech (TTS) using SpeechSynthesis or Azure Speech API.
- [x] Implement Voice-to-Text transcription next to audio messages.

## Phase 12: Matchmaking & Discovery UI

- [x] Analyse search screenshots in `original-hello-talk-screenshots/`.
- [x] Build Global Search UI with translated dropdowns for Native Language, Target Language, and Level.
- [x] Build Nearby Search PostGIS distance slider for VIP users.
- [x] Build VIP Profile Visitor Log UI with blurred cards for free users.

## Phase 13: HelloTalk Chat Specifics

- [x] Analyse chat UI screenshots in `original-hello-talk-screenshots/`.
- [x] Build HTML5 Canvas Doodle Pad component in chat modal.
- [x] Build Virtual Gift picker modal with coin balance auto-deduction.
- [x] Build Favourites bookmarking tab for saved messages and corrections.

## Phase 14: Live Audio Voicerooms UI

- [x] Categorise active Voicerooms by target language pair.
- [x] Build Stage UI with circular avatar grid for Speakers and audience list for Listeners.
- [x] Implement Raise Hand button and Approve Speaker modal for Hosts.
- [x] Build real-time text chat overlay inside live rooms.

## Phase 15: Advanced User Profiles

- [x] Build 30-second Audio Introduction recorder and playback card on profile.
- [STUCK] Implement dynamic Hobbies & Interests tags mapped to target vocabulary.
- [STUCK] Build Profile Cover Photo uploader with client-side cropping.

## Phase 16: Live Chat Micro-Interactions

- [x] Implement WebSockets typing indicators ("User is typing...").
- [x] Build Read Receipts (Sent vs Delivered vs Read checkmarks).
- [STUCK] Add long-press context menu on mobile to copy, favourite, or report messages.

## Phase 17: Audio & Video Calling (WebRTC / LiveKit)

- [STUCK] Build Incoming Call modal with ringtone audio and accept/reject controls.
- [STUCK] Implement active VoIP Call UI (Mute, Speakerphone, End Call).
- [STUCK] Build 1-on-1 Video Call interface with local preview overlay.

## Phase 18: Monetisation & VIP Tiers

- [STUCK] Build VIP Subscription showcase page detailing all premium benefits.
- [STUCK] Integrate Stripe Checkout for Monthly (8 UKP / $10 USD) and Yearly (50 UKP / $63 USD) plans.
- [STUCK] Build "Restore Purchases" button for app store compliance.

## Phase 19: Gamification & Study Streaks

- [STUCK] Build Daily Study Streak counter widget on home screen.
- [STUCK] Implement NestJS CRON job to reset streaks if inactive for 24 hours.
- [STUCK] Build "Top Corrector" community leaderboard.

## Phase 20: Spaced Repetition (SRS) Flashcards

- [x] Build Flashcard Deck UI to organize saved vocabulary.
- [x] Implement SRS review scheduling algorithm in NestJS.
- [x] Build interactive Flashcard Review UI (Flip animations and grading buttons).

## Phase 21: Push Notifications

- [STUCK] Integrate Firebase Cloud Messaging (FCM) in Angular.
- [STUCK] Build NestJS event listeners to dispatch push alerts for chats, comments, and profile views.
- [STUCK] Build Notification Preferences UI with granular category toggles.

## Phase 22: Moderation & Trust Engine

- [STUCK] Build "Report User" modal with dynamic category selection (BLOCKED: missing design spec, screenshots not accessible).
- [STUCK] Implement Blocklist system hiding blocked accounts across chat, feed, and search.
- [STUCK] Build automated NLP spam detector in NestJS to flag duplicate copy-paste messages.

## Phase 23: Onboarding Flow

- [STUCK] Build multi-step Angular onboarding wizard.
- [STUCK] Step 1: Native Language and Target Language selection.
- [STUCK] Step 2: Proficiency Level assessment.
- [STUCK] Step 3: Avatar upload and permissions prompt (Microphone, Camera).

## Phase 24: Advanced Search Filters

- [STUCK] Implement Gender filter in discovery (VIP tier).
- [STUCK] Implement Age Range dual-thumb slider controls.
- [STUCK] Add "Voice Room Active" filter to find users currently hosting streams.

## Phase 25: Voiceroom Management

- [x] Build Voiceroom Creation modal (Title, Language Pair, Topic).
- [x] Implement frontend Angular UI for Voiceroom Creation modal.
- [x] Implement Host Moderation controls (Mute speaker, kick off stage).
- [x] Build animated audio equalizer visualizer for active stage speakers.

## Phase 26: Group Chats

- [x] Build "Create Group" UI supporting up to 50 users.
- [x] Implement Group Admin privileges (Add/remove members, rename group).
- [x] Build group participant drawer.
- [x] Implement group participant drawer UI component.

## Phase 27: Offline Support & PWA

- [x] Configure Angular Service Worker (`@angular/pwa`) for asset caching.
  - [x] Run `ng add @angular/pwa` in the `frontend` directory to generate service worker configuration.
- [x] Implement IndexedDB message queuing for offline chat composition.
- [x] Write the IndexedDB wrapper service and integrate it with ChatService for offline queuing.
- [x] Build global "No Network Connection" banner component.

## Phase 28: Accessibility (a11y)

- [x] Audit and add `aria-label` attributes to all icon buttons and interactive tags. (`moments-feed.component.html`'s 3 `<img>` tags now have `alt` text via `moments.avatarPreviewAlt` / `moments.mediaThumbnailAlt` / `moments.momentImageAlt`, and `hobby-tags.component.ts`'s `hobby.removeTag` aria-label now falls back to `hobby.unknownTagName` when `hobby_tag` is unpopulated. Verified: `npx eslint` on both files is clean and `ng build` compiles with no errors.)
- [x] Fix remaining `@angular-eslint/template/alt-text` error found during the above audit: `user-detail.component.html:22`'s cover photo `<img [src]="profile()?.cover_photo_url" />` has no `alt` attribute. (Added `[alt]` bound to new `userProfile.coverPhotoAlt` translate key, parameterised with the profile's display name. Verified: `npx eslint` on the file is clean and `tsc --noEmit` shows no errors.)
- [x] Implement Dynamic Font Size slider adjusting base `rem` CSS rules. (Added `FontScaleService` (`frontend/src/app/services/font-scale.service.ts`), which persists a 80-150% scale to `localStorage` and sets `document.documentElement.style.fontSize` so every Tailwind `rem` utility across the app scales together. Wired a slider into `SettingsComponent` under a new "Accessibility" section, and injected the service in `AppComponent` so the persisted scale boot. Verified: `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` are clean, and `ng test --no-watch` passes 115/119 (28/28 spec files, 4 pre-existing skips) including the new `font-scale.service.spec.ts`. Follow-up review found `font-scale.service.ts` and `font-scale.service.spec.ts` were left untracked by git (`??`), so they were invisible to `git diff HEAD` and would have been silently dropped from the next commit even though `SettingsComponent`/`AppComponent` already depend on them; `git add`ed both to fix.)
- [x] Ensure full keyboard tab-navigation support for desktop viewports.

## Phase 29: Deep Linking & SEO

- [x] Configure Angular Router to handle deep links (`hellotalk://profile/:id`).
- [x] Configure Angular Universal (SSR) for public Voiceroom preview pages.
  - [x] Run `ng add @angular/ssr` in the `frontend` directory to generate server files.
  - [x] Update `server.ts` to handle `/voiceroom-preview/:id` routes.
  - [x] The previous commit only fixed a linting error in the component; the actual SSR scaffolding (`ng add @angular/ssr`) still needs to be executed.

## Phase 30: Media Pipeline Optimisation

- [x] Implement client-side image compression (max 1080p) before R2 upload.
- [STUCK] Integrate ImageCompressionService into the R2 upload flow (e.g., in MediaService or component upload handlers).
- [x] Implement audio compression converting voice notes to lightweight `.m4a`/`.ogg`.
- [x] Build AudioCompressionService to handle client-side audio transcoding.
- [x] Implement actual client-side transcoding in AudioCompressionService using ffmpeg.wasm or Web Audio API.
- [x] Integrate AudioCompressionService into VoiceRecorderComponent.
  - [x] Update VoiceRecorderComponent to call compressAudio before uploading.
- [x] Integrate server-side AudioCompressionService into the media upload flow for voice notes.
- [x] Update backend MediaController/MediaService to call AudioCompressionService.compressToOgg or compressToM4a during voice note uploads.

## Phase 31: Legal & GDPR Compliance

- [x] Build dynamic Terms of Service and Privacy Policy document viewer.
- [x] Create routes and pages for Terms of Service and Privacy Policy using the viewer component.
- [x] Add Angular routes for `/terms` and `/privacy` and create the corresponding page components.
- [x] Implement "Download My Data" button triggering a NestJS JSON export worker.
- [x] Build the NestJS JSON export worker and wire it to the Angular frontend.
- [x] Build Account Deletion workflow with 30-day grace period.
- [x] Implement backend cron job for 30-day grace period deletion.

## Phase 32: Custom Stickers & Emojis

- [x] Build Sticker Store UI.
- [x] Allow spending virtual coins to unlock animated sticker packs.
- [STUCK] Build custom sticker picker drawer inside chat window.

## Phase 33: User Analytics Dashboard

- [x] Build "My Stats" dashboard tracking study hours, messages sent, and corrections made.
- [x] Render visual charts using Chart.js inside Angular.
- [STUCK] Implement backend endpoints for user statistics.

## Phase 34: UI Theming

- [STUCK] Build Theme Selector (Dark, Light, System Default).
- [x] Allow VIP users to select custom primary accent colours.
- [x] Build UI for VIP users to select custom primary accent colours in settings.

## Phase 35: App Performance

- [x] Implement Angular Lazy Loading for non-critical feature modules.
- [x] Audit Web Vitals and optimize images using `loading="lazy"`.

## Phase 36: Backend Rate Limiting

- [STUCK] Configure NestJS `@nestjs/throttler` on sensitive authentication endpoints.
- [x] Implement WebSocket connection rate limiting in Centrifugo.

## Phase 37: WebRTC Fallback Infrastructure

- [x] Configure STUN/TURN server credentials in LiveKit for strict corporate NAT networks.

## Phase 38: Live Stream Viewer Mechanics

- [x] Build scrolling live chat comment overlay over host video stream.
- [x] Implement full-screen SVG gift animations when viewers tip the host.
- [x] Integrate ngx-lottie or similar to render actual SVG animations for gifts.
- [x] Create GiftAnimationComponent and integrate it into chat/feed for gift payloads.

## Phase 39: Live Stream Host Mechanics

- [STUCK] Build Host Dashboard showing live viewer count, earned coins, and stream uptime.
- [x] Implement "Invite Co-Host" split-screen video layout.
- [x] Fix `inviteCoHost` to demote/notify the existing co-host (and stop their publish) before assigning a new one, instead of silently overwriting `co_host_id`.
- [x] Fix race condition where the `co_host_removed`/`co_host_invited` Centrifugo events published in `inviteCoHost` can arrive out of order (both are fire-and-forget, unawaited HTTP calls), and the frontend's `co_host_removed` handler unconditionally nulls `co_host_id` without checking it still matches the removed user, which can wipe out a just-assigned new co-host.

## Phase 40: Moment Inter interactivity

- [x] Build "Liked By" modal listing all users who liked a Moment.
- [x] Create backend endpoint to fetch users who liked a specific moment.
- [x] Create Angular component for the Liked By modal.
- [x] Implement `@mention` notifications when tagged in a comment.
- [x] Actually implement the @mention logic in the comments service and frontend (the previous diff only contained audio-room co-host changes).

## Phase 41: Language Assessment Test

- [x] Build dynamic diagnostic quiz component for new sign-ups.
- [x] Implement frontend Angular component for the diagnostic quiz.
- [x] Fetch multiple-choice assessment questions from backend database.

## Phase 42: Daily Check-in Rewards

- [x] Build daily login modal granting 5 to 10 free virtual coins upon first daily login.
- [x] Implement backend endpoint for daily check-in coin reward and frontend modal UI.

## Phase 43: Message Translation Toggle

- [x] Cache translated text client-side to allow toggling between original and translation without extra API calls.
- [x] Implement the actual caching logic in the frontend chat service/components (the provided diff only contained audio-room co-host changes).

## Phase 44: Audio Auto-Play Settings

- [x] Add settings toggle to auto-play sequential voice notes in chat.
  - [x] Create SettingsService to persist auto-play preference.
  - [x] Add UI toggle in SettingsComponent.
  - [x] Update ChatRoomComponent to listen for audio 'ended' events and play the next voice note if enabled.

## Phase 45: Image Gallery Viewer

- [x] Build swipeable full-screen lightbox for Moments with multiple images.
- [x] Implement the actual frontend Angular component for the swipeable full-screen lightbox (the previous diff only contained audio-room co-host changes).

## Phase 46: Partner Recommendation Algorithm

- [x] Build NestJS background job calculating top 10 recommended language partners daily.
- [x] Implement the actual background job (the provided diff was for audio-room co-hosts, not partner recommendations).

## Phase 47: Unread Badge Logic

- [x] Implement global unread counter service updating app badge and navigation tabs.
- [x] Integrate UnreadCounterService into navigation tabs UI to display unread badges.
- [x] Actually implement the UnreadCounterService integration in the frontend navigation tabs (the provided diff was for audio-room co-hosts).
- [x] The latest provided diff was still for audio-room co-hosts (`inviteCoHost`/`removeCoHost`), not the navigation tabs UI. Please provide the correct frontend changes.
- [x] Update `frontend/src/app/app.component.html` to visually render the unread badges using `unreadCounter.totalUnread()` (Requires HTML file).

## Phase 48: E2E Testing (Cypress)

- [x] Setup Cypress inside `frontend/`.
- [x] Actually install and configure Cypress in the frontend directory (the previous diff was for audio-room co-hosts).
- [x] Write E2E test flows for Authentication, Chat Messaging, and Moment Creation.

## Phase 49: Unit Testing (Jest)

- [x] Write NestJS unit tests for `DiscoveryService` PostGIS queries.
- [x] Actually write the NestJS unit tests for `DiscoveryService` PostGIS queries (the previous diff was for audio-room co-hosts).
- [x] The latest diff provided was STILL for audio-rooms co-hosts. Please actually write the tests for DiscoveryService in backend/src/discovery/discovery.service.spec.ts.
- [x] Write Angular unit tests for `VocabularyStore` signals.
- [x] The latest diff provided was for audio-rooms co-hosts, not VocabularyStore. Please actually write the Angular unit tests for VocabularyStore signals in frontend/src/app/services/vocabulary.store.spec.ts.
- [x] The diff provided was STILL for audio-rooms co-hosts. Please actually write the Angular unit tests for VocabularyStore signals in frontend/src/app/services/vocabulary.store.spec.ts.

## Phase 50: Admin Dashboard (Users)

- [x] Build Angular Admin Portal for user management.
- [x] Build admin table to search users, inspect login history, and toggle VIP status manually.
- [STUCK] Admin portal: `AdminService.setVipStatus`/`listUsers`/`getLoginHistory` (frontend/src/app/services/admin.service.ts) silently `catchError` into mock data on any HTTP failure, including a real 403 from the backend `AdminGuard`. Because the `/admin` route has no client-side guard, a non-admin who browses to it sees a fully populated fake user list, and clicking Grant/Revoke VIP appears to succeed even though no backend mutation happened. Surface real errors for admin actions instead of faking success (the mock fallback is fine for read-only browsing/demo mode, but not for a PATCH that changes VIP status).

## Phase 51: Admin Dashboard (Moderation)

- [x] Build Moderation Queue UI to review flagged Moments and profiles.
- [x] Implement 1‑click ban and warning buttons.
- [x] Restore backend `banUser` and `warnUser` endpoints (removed in the latest diff) so the admin-actions component can actually call them.

## Phase 52: Help Centre

- [STUCK] Build in-app Help Centre fetching dynamic FAQ articles from backend.

## Phase 53: Version Enforcer

- [x] Build NestJS endpoint returning minimum supported app version.
- [x] Build blocking update modal in Angular if current app version is deprecated.

## Phase 54: Automated Code Formatting

- [x] Configure Prettier and Husky git pre-commit hooks.

## Phase 55: GitHub Actions CI/CD

- [x] Create `.github/workflows/deploy.yml` for automated testing and Docker image builds.

## Phase 56: Server Monitoring

- [x] Configure Prometheus and Grafana Docker containers for NestJS and Centrifugo metrics.

## Phase 57: Global Error Handler

- [x] Implement custom Angular `ErrorHandler` logging client crashes to backend analytics.

## Phase 58: Empty States

- [x] Design custom vector illustrations for "No Messages", "No Moments Found", and "No Users Nearby".

## Phase 59: Input Sanitisation

- [x] Implement strict HTML sanitisation using `DOMPurify` on all user-submitted text.
- [x] Exempt non-user-authored body fields (client error `stack` traces in `LogClientErrorDto`, Apple/Google IAP webhook payloads) from the global `SanitiseHtmlPipe`, which currently strips angle-bracket content like `<anonymous>` and generic type params from stack traces before they reach analytics.

## Phase 60: Drafts System

- [x] Persist unsent chat messages and Moment drafts to `localStorage`. (Added `DraftsService` (`frontend/src/app/services/drafts.service.ts`) with per-room chat draft keys (`hellotalk_chat_draft_{roomId}`) and a single moment compose draft key (`hellotalk_moment_draft`), guarded for SSR/no-`localStorage` environments. Wired into `ChatRoomComponent`: loads the room's draft into `textInput` on room load, persists on every keystroke via `onTextInputChange`. Wired into `MomentsFeedComponent`: loads the compose draft (text, media URLs/type, target language) on init and reopens the compose form if one exists, persists on text/media changes, and clears it once a moment is published successfully (correctly only clears after the `createMoment` await succeeds). Verified: `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` show no new errors (pre-existing unrelated `environments/environment` and `moderation.service.ts` errors confirmed present before this change via `git stash`).)
- [x] Fix `ChatRoomComponent.sendTextMessage()` (`frontend/src/app/components/chat-room/chat-room.component.ts:171`): it clears `textInput` and calls `draftsService.clearChatDraft()` _before_ `chatService.sendMessage` is awaited, with no restore in the `catch` block. A failed send (offline, server error, moderation rejection) currently loses the message text entirely instead of leaving it recoverable as a draft. Move the clear to after a successful send, matching the pattern already used correctly in `MomentsFeedComponent.submitMoment()`.

## Phase 61: Link Previews

- [x] Build NestJS OpenGraph scraper rendering rich link preview cards in chat.
- [x] Implement the NestJS OpenGraph parser service: fetch URL, extract title/description/image with `cheerio` + `dompurify`, cache results, and expose `GET /link-preview?url=...` for the chat frontend.
- [x] Complete the implementation of the NestJS OpenGraph scraper and frontend rendering.
- [x] Write the NestJS controller and service logic for the OpenGraph scraper (dependencies are installed).
- [x] Implement actual OpenGraph service using installed dependencies (cheerio, dompurify, jsdom).
- [x] Create `LinkPreviewModule`, `LinkPreviewController` and `LinkPreviewService` in `backend/src/link-preview/` that uses `jsdom`/`cheerio` to fetch a URL, extract OpenGraph tags, sanitise with DOMPurify, cache results for 1 hour, and expose `GET /link-preview?url=...`.
- [x] Write the actual NestJS code for the OpenGraph scraper (`LinkPreviewModule`, `LinkPreviewController`, `LinkPreviewService`) since only the dependencies were installed in the previous step.
- [x] Wire `LinkPreviewModule` into the main `AppModule` imports array.

## Phase 62: System Messages

- [x] Render custom system event bubbles in chat (e.g., "Profile updated", "Missed call").
- [x] Create system message integration (backend Centrifugo publish and frontend i18n bubble).
- [x] Build `system-message-bubble` component handling i18n keys 'system.profileUpdated', 'system.missedCall' and wire to Centrifugo events.
- [x] Complete implementation of system event bubbles (the diff provided for Phase 62 only touched unrelated configuration files and did not deliver the feature).
- [x] Implement the actual system‑message bubble rendering (chat component, i18n keys, and Centrifugo integration) – currently missing from the codebase.

## Phase 63: Account Recovery

- [STUCK] Build "Forgot Password" UI and NestJS email dispatch service.

## Phase 64: Self-Healing QA & Visual Refinement Loop

- [STUCK] AUTONOMOUS DIRECTIVE: Execute complete codebase audit. Verify zero hardcoded strings exist, confirm visual match against `original-hello-talk-screenshots/`, run test suites, and append any remaining visual bugs as new tasks below. Leave this box unchecked to loop continuously.

## Phase 65: Comprehensive App Settings, Legal, & Security Architecture

### Authentication & Account Security

- [STUCK] Build Social Login UI components (Google, Facebook, Apple OAuth buttons).
- [STUCK] Build "Linked Accounts" settings page to manage connected social accounts.
- [STUCK] Build Password Policy & Reset UI with real-time regex validation (min 8 chars, numbers, symbols).

### Appearance & UI Configuration

- [STUCK] Build "Appearance Settings" menu.
- [STUCK] Implement System-wide Dark Mode, Light Mode, and System Default toggle.
- [STUCK] Implement UI & Font Scaling slider adjusting base `rem` units across Angular.
- [STUCK] Build "Language Settings" menu to switch UI language independently of study target.

### Privacy, Blocking & Discoverability

- [STUCK] Build "Privacy Settings" hub.
- [STUCK] Implement "Who can see my profile" toggle (Everyone, VIPs only, Hidden).
- [STUCK] Build "User Filter Settings" to restrict initial message senders by age or native language.
- [STUCK] Build "Block Management" page to manage and unblock users.

### Notifications & Alerts

- [STUCK] Build unified "Notifications Area" (Inbox) for system alerts, likes, comments, and followers.
- [STUCK] Build "Notification Settings" toggles for Push Alerts and Badges across Direct Messages, Groups, Likes, and Voicerooms.

### Chat & Data Storage Settings

- [STUCK] Build "Chat Settings" page (Toggle Auto-Translate, Read Receipts, Enter-to-Send).
- [STUCK] Build "Data & Storage" page (Clear Local Cache, toggle cellular data auto-downloads).

### Legal, Help & GDPR Compliance

- [STUCK] Build "Help & About" page displaying App Version, build number, and open-source licences.
- [STUCK] Build "Personal Data Collection" GDPR hub with "Request My Data Archive" button and automated "Delete Account" workflow.

## Phase 66: Enhanced Profile & Matchmaking

- [STUCK] Add `proficiency_level` (`'a1'` to `'c2'`) to `users` table schema and profile UI.
- [STUCK] Implement proficiency level filter in Discovery search.
- [STUCK] Build "Interests" tagging UI in profile settings (e.g., "tech", "travel", "movies").
- [STUCK] Add "Interests" filter to Discovery search to match users with shared hobbies.
- [STUCK] Add "Learning Goals" free-text field to user profile to state user motivations.

## Phase 67: AI-Powered Learning Tools

- [STUCK] Design and build AI Conversation Partner chat interface.
- [STUCK] Implement NestJS service to proxy chat messages to a Large Language Model (e.g., GPT-4, Llama).
- [STUCK] Add "Explain this" context menu option on corrected text to get AI-generated grammar breakdown.
- [STUCK] Implement AI-generated suggested replies in chat based on conversation context.
- [STUCK] Build "Role-play" scenarios for AI chat (e.g., "ordering coffee", "job interview").

## Phase 68: Gamification & Engagement Hooks

- [STUCK] Design database schema for user achievements (`achievements` table, `user_achievements` join table).
- [STUCK] Build Achievements service in NestJS to award badges for milestones (e.g., "100 messages sent", "7-day streak").
- [STUCK] Build Achievements showcase page on user profiles.
- [ ] Implement a point-based XP system, granting XP for learning activities.
- [ ] Build Daily/Weekly Quests feature with coin rewards (e.g., "Correct 3 moments today").

## Phase 69: Structured Learning Content

- [ ] Build "Lessons" module in Angular.
- [ ] Create database schema for curated learning content (articles, dialogues by CEFR level).
- [ ] Build CMS or admin interface to upload and manage lesson content.
- [ ] Implement "Word of the Day" feature on the app's home screen.
- [ ] Integrate short cultural etiquette guides for different languages within the app.

## Phase 70: UI/UX Polish & Animation

- [ ] Implement skeleton loaders (`ngx-skeleton-loader`) for all data-heavy components (feed, chat, profiles).
- [ ] Add subtle micro-animations (`framer-motion` or CSS) to button clicks and hover states.
- [ ] Animate Angular route transitions for a smoother navigation feel.
- [ ] Build an interactive, multi-step product tour for new users using a library like `ngx-joyride`.
- [ ] Refine chat bubble appearance with distinct sent/received styles and message-tail pointers.
- [ ] Add haptic feedback on mobile for key actions (e.g., sending message, liking a post).

## Phase 71: Enhanced Content Interaction

- [ ] Implement 'Create Flashcard' context menu option for any text selection within chat messages and moment posts.
- [ ] Build 'Correction Quality' rating system (up/down votes) for community corrections on Moments.
- [ ] Implement a user-level 'Corrector Score' based on ratings to display on profiles.

## Phase 72: Advanced AI-Tutor Features

- [ ] Integrate AI to auto-generate `explanation` field for `correction` payloads in chat if the human corrector leaves it blank.
- [ ] Build "Simplify this text" AI feature in the message context menu for learners to understand complex sentences.
- [ ] Implement AI-powered 'Conversation Starter' suggestions in new chat windows based on partner's profile interests.

## Phase 73: Deeper Gamification & Retention

- [ ] Build celebratory full-screen animation/confetti for completing study streaks (e.g., 7, 30, 100 days).
- [ ] Implement "Partner of the Week" algorithm to highlight highly-rated language partners in the Discovery feed.
- [ ] Add haptic feedback for grading flashcards (e.g., success buzz for 'Known', gentle pulse for 'Learning').

## Phase 74: Voiceroom Learning Tools

- [ ] Build shared 'Voiceroom Notes' panel where hosts/speakers can post key vocabulary or discussion topics.
- [ ] Implement LiveKit EgressClient to generate and save a full transcript of completed audio room sessions for participants to review.
- [ ] Add AI-generated 'Session Summary' to the archived audio room recording, listing key topics and vocabulary discussed.

## Phase 75: Advanced Voiceroom Inter interactivity

- [ ] Implement real-time translation for the text chat overlay inside Voicerooms.
- [ ] Build a "Quick Poll" feature for Voiceroom hosts to create multiple-choice questions for the audience.
- [ ] Add a "Soundboard" feature for hosts to play pre-recorded audio clips (e.g., applause, jingles).

## Phase 76: Advanced Discovery & Onboarding

- [ ] Build "Audio Intros" feed in Discovery to browse users by listening to their spoken introductions.
- [ ] Implement "Translate Bio" button on user profile cards and pages.

## Phase 77: Collaborative Learning Tools

- [ ] Build UI for threaded replies in chat to preserve conversation context.
- [ ] Implement "Request Correction from Group" feature/message type for group chats.
- [ ] Add a "Mute Word" client-side filter for the Moments feed to hide posts with specific keywords.

## Phase 78: Proactive AI Tutor

- [ ] Implement AI-powered "Daily Learning Tip" push notification or chat message.
- [ ] Build "Suggest Flashcards" feature to auto-detect and suggest new vocabulary from a user's conversations.

## Phase 79: Economy-Driven Learning

- [ ] Allow spending virtual coins to unlock premium one-off AI services (e.g., "Conversation Analysis Report").
- [ ] Build "Language Challenge" system with coin-based entry fees and prize pools (e.g., "7-day writing streak challenge").

## Phase C: Chat Interface Feature Checklist (WhatsApp Clone)

### 1. Core Messaging & Chat Mechanics

- [x] Real-time text messaging with delivery and read receipts (single tick, double tick, blue tick).
- [x] Typing indicators and online status visibility.
- [x] Message reactions using emojis.
- [x] Reply to specific messages (swipe-to-reply gesture).
- [x] Forwarding messages with a "forwarded" label to prevent spam.
- [x] Edit sent messages within a specific time limit.
- [x] Delete messages for the sender or for everyone.
- [x] Starred messages for easy retrieval.
- [x] Search functionality within individual chats or across all conversations.
- [x] Pin priority chats to the top of the inbox.
- [x] Chat archiving and hidden chat folders.
- [x] Rich link previews for URLs.

### 2. Media & File Sharing

- [x] Photo and video sharing with an HD quality toggle.
- [x] Instant video messages (short circular video notes).
- [x] Voice messages with playback speed control (1x, 1.5x, 2x).
- [x] Document and file sharing (pdfs, spreadsheets, etc.).
- [x] Location sharing (live location and current location).
- [x] Contact sharing.
- [x] Doodle message sharing.

### 3. Audio & Video Calls

- [x] End-to-end encrypted voice calls.
- [ ] End-to-end encrypted video calls.
- [ ] Group calls with a specific participant limit.
- [ ] Call waiting and switching between calls.
- [ ] Picture-in-picture mode for video calls.
- [ ] Screen sharing during video calls.
- [ ] Call logs (missed, incoming, outgoing).

### 4. Group Chats & Communities

- [ ] Create and manage group chats.
- [ ] Admin controls (add/remove members, restrict who can send messages or edit group info).
- [ ] Mentioning participants (@mentions).
- [ ] Group descriptions and rules.
- [ ] Join groups via invite links or QR codes.
- [ ] Communities feature to organize related groups under one umbrella.
- [ ] Announcement groups for admins to broadcast messages.

### 5. Status & Stories

- [ ] Share text, photo, video, and voice updates that disappear after 24 hours.
- [ ] Privacy controls for who can view status updates.
- [ ] Reply to status updates directly in chat.
- [ ] View list of users who have seen the status.

### 6. Privacy & Security

- [x] End-to-end encryption for all personal messages and calls.
- [x] Disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- [ ] View once media (photos/videos that disappear after being opened).
- [x] Block and report users or businesses.
- [ ] Two-step verification (2FA).
- [ ] Fingerprint/Face ID lock for the app.
- [ ] Control over who can see "Last Seen", profile photo, about info, and status.
- [ ] Silence unknown callers.
- [ ] Chat Lock (hide specific chats in a locked folder).

### 7. User Profiles & Settings

- [ ] Customizable profile picture and "About" status.
- [ ] Custom chat wallpapers.
- [ ] Notification customization (custom tones, vibration patterns).
- [ ] Data and storage usage controls (auto-download settings).
- [ ] Export chat history.
- [ ] Multi-device support (use the app on linked devices without keeping the phone online).
- [ ] Account transfer between devices.

### 8. Business Features (Optional)

- [ ] Business profiles with business hours, website, and catalog.
- [ ] Quick replies for frequently asked questions.
- [ ] Automated greeting and away messages.
- [ ] Labels to organize chats and customers.
- [ ] Cart and catalog integration for shopping.

## Phase 80: The Moments Engine (HelloTalk Features)

### Post Creation & Sharing

- [ ] Implement Multimedia Posts (text, photos, and voice notes).
- [ ] Build Targeted Visibility routing (posts display to native speakers of target language).

### Feedback & Corrections

- [ ] Implement Instant Grammar Fixes (direct text editing by native speakers).
- [ ] Build Voice Feedback functionality for pronunciation corrections.
- [ ] Add Detailed Explanations UI for context and alternative expressions.

### Community & Q&A

- [ ] Build Language Questions post type.
- [ ] Implement Cultural Insights tagging and filtering.
- [ ] Build Milestone Tracking for progress and study buddy matching.

### Content Management

- [ ] Build Resource Library for saving helpful posts and tips.
- [ ] Implement Organised Collections (sort by topic/difficulty).
- [ ] Build Offline Access functionality for saved content.

## Phase 81: HelloTalk Profile System

### Basic User Information

- [ ] Build Avatar upload and client-side cropping tool.
- [ ] Implement Native Language and Target Language selection with proficiency levels.
- [ ] Display Nationality, Region, Age, and Gender fields.

### Multimedia & Introductions

- [ ] Build Profile Cover Photo upload and positioning.
- [ ] Implement Text Bio section with inline translation support.
- [ ] Build 30-second Audio Introduction recording and playback widget.
- [ ] Add selectable Hobbies and Interests tags.

### Stats & Gamification

- [ ] Display Daily Study Streak counter.
- [ ] Show total lifetime counts for Translations, Corrections, and Moments.
- [ ] Display earned user badges (VIP status, Serious Learner).

### Social & Interactivity

- [ ] Implement Followers and Following lists with numeric counters.
- [ ] Build direct "Send Message" and "Follow" action buttons on external profiles.
- [ ] Implement "Who Viewed Me" visitor logs.

### Privacy & Settings

- [ ] Build toggles to hide or show exact location and online status.
- [ ] Implement Block User and Report User workflows directly from the profile.
- [ ] Add incognito mode for profile visiting (VIP feature).

## Phase 82: HelloTalk Settings System

### Account & Security

- [ ] Build Linked Accounts management (Email, Google, Apple).
- [ ] Implement Password reset and change workflows.
- [ ] Build Account Deletion and data export requests.

### Privacy & Discoverability

- [ ] Implement "Who can message me" filters (Age, Gender, Native Language).
- [ ] Build Location Privacy toggles (Exact location vs. Region only).
- [ ] Add "Hide Online Status" and "Hide VIP Status" toggles.
- [ ] Build Blocked Users management list.

### Notifications

- [ ] Build granular Push Notification toggles (Messages, Comments, Likes, Followers).
- [ ] Implement In-App Sound and Vibration settings.
- [ ] Add "Do Not Disturb" scheduling.

### Chat & Language Settings

- [ ] Build App UI Language selector.
- [ ] Set Default Translation Language.
- [ ] Implement Chat specific settings (Enter to send, Text size customisation).

### Data & Storage

- [ ] Build Local Storage management (Clear cache, Delete old media).
- [ ] Implement Auto-Download preferences (Wi-Fi only vs. Cellular).
- [ ] Build Chat Backup and Restore functionality.

### VIP & Subscriptions

- [ ] Build Subscription Management portal.
- [ ] Add "Restore Purchases" workflow.

### Help & About

- [ ] Add Support Centre and FAQ viewer.
- [ ] Implement App Version display and update checker.
- [x] Build Terms of Service and Privacy Policy document viewers.

## Phase 83: HelloTalk Find Partners System

### Core Discovery & Sorting

- [ ] Implement sorting algorithms (Best Match, Online Now, Nearest, Newest).
- [ ] Build global user query engine based on Native and Target language pairs.
- [ ] Add "Serious Learner" toggle to filter for active study streaks.

### Advanced Search Filters

- [ ] Build Age Range dual-thumb slider.
- [ ] Implement Gender filter dropdown (often restricted to VIP).
- [ ] Add Language Proficiency filter (Beginner, Intermediate, Advanced).
- [ ] Implement "Has Audio Intro" required filter.

### Location & Proximity Search

- [ ] Build GPS-based "Nearby" search rendering distance in miles or kilometres.
- [ ] Implement specific Country and City manual search.
- [ ] Build Location Spoofing functionality for VIP users to search as if in another country.

### Discovery UI & Interactions

- [ ] Build Profile Discovery Cards displaying avatar, name, languages, and short bio.
- [ ] Implement inline Audio Intro play button directly on the search card.
- [ ] Add quick-action "Send Message" and "Follow" buttons on list items.
- [ ] Display online status indicators (green dot) and last active timestamps.

### Algorithmic Recommendations

- [ ] Build "Recommended for You" carousel based on mutual interests and activity levels.
- [ ] Implement new user spotlight to highlight recently joined native speakers.

## Phase 84: Tandem Parity (Core Features)

> **Why Tandem is considered better by some:** Tandem focuses heavily on a structured, serious learning environment with fewer social-media "distractions" (like a global feed) compared to HelloTalk. It provides stronger matching algorithms, detailed filtering by learning goals, and a cleaner interface dedicated solely to 1-on-1 and group language exchange.

- [ ] Build a "Serious Learner" mode toggle that hides social feeds and prioritizes 1-on-1 matching based on strict language goals.
- [ ] Implement advanced, detailed search filters matching Tandem (e.g., search by exact availability times, specific learning goals).
- [ ] Build a dedicated web application (Tandem Web parity) allowing users to chat and correct messages from a desktop browser.
- [ ] Implement in-app translations and language corrections with an interface mirroring Tandem's highly structured correction UI.
- [ ] Design and implement a "Pro" subscription tier mimicking Tandem Pro (unlimited translations, advanced visitor logs, nearby members visibility, ad-free).
- [ ] Build a robust community moderation tool to strictly enforce learning-only behavior (preventing dating-app behavior), which is a key selling point for Tandem.

## Phase 85: Tandem Language Groups (Text-based)

- [ ] Build "Group Chats" feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests (e.g., "Beginner French Grammar").
- [ ] Implement real-time text correction tools specifically designed to work within Group Chats (allowing members to correct each other's messages).
- [ ] Build a "Groups Discovery" tab within the chat interface for users to browse and join active group chats by topic.
- [ ] Implement Group Admin controls to manage membership and moderate shared resources/links within the group.

## Phase 86: Tandem Parties (Live Audio Rooms)

- [ ] Build "Language Parties" live audio rooms dedicated to spoken practice in a group setting.
- [ ] Implement audio room categorization by topic and target language level.
- [ ] Build "Private Parties" feature (VIP/Pro tier) allowing invite-only audio rooms for specific friends or study partners.
- [ ] Implement exclusive animated emojis and reactions during live audio sessions for Pro members.

## Phase 87: Scheduled Events & Meetups

- [ ] Build a centralized "Events" discovery feed for users to find upcoming scheduled activities.
- [ ] Implement "Create Event" modal requiring fields: Title (What), Date & Time (When), Platform/Location (Where - e.g., Audio Room, Zoom, In-person), and Description.
- [ ] Build Event categories (e.g., Audio Rooms, Learning Seminars, In-person Meetups, Cultural Exchanges).
- [ ] Implement RSVP functionality allowing users to mark "Attending" or "Interested".
- [ ] Build automated push notification reminders (e.g., "Your Spanish Learning Event starts in 15 minutes").
- [ ] Integrate events with the "Language Parties" system, allowing scheduled audio rooms to automatically spin up at the designated time.
- [ ] Implement a calendar view for users to track all their upcoming RSVP'd events.
