# TODO.md (Master HelloTalk Clone Architecture: Phases 1 to 79 + Phase C)

## GLOBAL ARCHITECTURAL RULES
* **RULE 1:** ABSOLUTELY NO HARD-CODED DATA. All content, user profiles, and UI copy must be fetched dynamically or piped through `@ngx-translate`.
* **RULE 2:** STRICT i18n (`@ngx-translate`). No raw text strings allowed inside Angular HTML templates.
* **RULE 3:** PIXEL-PERFECT CLONING. Every UI component must be visually verified against the `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/` directory.

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
- [x] Build Angular Audio/Video Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- [x] Implement Stage Management API & UI:
    - Listener clicks "Raise Hand" (`POST /audio-rooms/raise-hand`).
    - Host approves request (`POST /audio-rooms/approve-speaker`).
    - NestJS issues refreshed LiveKit JWT with `canPublish: true`.
- [x] Build synchronised text chat overlay (`RoomChatComponent`) inside live rooms powered by Centrifugo (`room_{id}` channel).
- [x] Implement real-time AI speech-to-text subtitles broadcasting closed captions into live rooms.
- [x] Build stream recording & replay archive storage (`POST /audio-rooms/archive`) saving LiveKit composite recordings to Cloudflare R2.

## Phase 7: VIP Monetisation, Virtual Economy & Trust/Safety
- [x] Build NestJS `MonetisationController` handling Stripe & App Store webhooks (`POST /webhooks/stripe`) to toggle `user.is_vip` and `vip_tier`.
- [x] Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent): unlimited AI, 3 target languages, location spoofing, incognito profile views.
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
- [x] Analyse Moments feed screenshots in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`.
- [x] Build Moments Feed UI with infinite scrolling (15 posts per batch).
- [x] Build multi-media attachments UI: text, up to 9 static images in CSS grid, or a 60s voice note.
- [x] Build Audio Player component with waveform visualizer, play/pause, and timestamp tracker.
- [x] Integrate `VisualDiffComponent` into Moments comment section for corrections.

## Phase 11: In-App NLP & Learning Utilities
- [x] Analyse chat context menu screenshots in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`.
- [x] Build in-line Message Context Menu: Translate, Transliterate, Speak, and Correct.
- [x] Implement Transliteration UI (render Romaji/Pinyin below text in small grey font).
- [x] Implement Text-to-Speech (TTS) using SpeechSynthesis or Azure Speech API.
- [x] Implement Voice-to-Text transcription next to audio messages.

## Phase 12: Matchmaking & Discovery UI
- [x] Analyse search screenshots in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`.
- [x] Build Global Search UI with translated dropdowns for Native Language, Target Language, and Level.
- [x] Build Nearby Search PostGIS distance slider for VIP users.
- [x] Build VIP Profile Visitor Log UI with blurred cards for free users.

## Phase 13: HelloTalk Chat Specifics
- [x] Analyse chat UI screenshots in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`.
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
- [ ] Build Notification Preferences UI with granular category toggles.

## Phase 22: Moderation & Trust Engine
- [ ] Build "Report User" modal with dynamic category selection (BLOCKED: missing design spec, screenshots not accessible).
- [ ] Implement Blocklist system hiding blocked accounts across chat, feed, and search.
- [ ] Build automated NLP spam detector in NestJS to flag duplicate copy-paste messages.

## Phase 23: Onboarding Flow
- [ ] Build multi-step Angular onboarding wizard.
- [ ] Step 1: Native Language and Target Language selection.
- [ ] Step 2: Proficiency Level assessment.
- [ ] Step 3: Avatar upload and permissions prompt (Microphone, Camera).

## Phase 24: Advanced Search Filters
- [ ] Implement Gender filter in discovery (VIP tier).
- [ ] Implement Age Range dual-thumb slider controls.
- [ ] Add "Voice Room Active" filter to find users currently hosting streams.

## Phase 25: Voiceroom Management
- [ ] Build Voiceroom Creation modal (Title, Language Pair, Topic).
- [ ] Implement Host Moderation controls (Mute speaker, kick off stage).
- [ ] Build animated audio equalizer visualizer for active stage speakers.

## Phase 26: Group Chats
- [ ] Build "Create Group" UI supporting up to 50 users.
- [ ] Implement Group Admin privileges (Add/remove members, rename group).
- [ ] Build group participant drawer.

## Phase 27: Offline Support & PWA
- [ ] Configure Angular Service Worker (`@angular/pwa`) for asset caching.
- [ ] Implement IndexedDB message queuing for offline chat composition.
- [ ] Build global "No Network Connection" banner component.

## Phase 28: Accessibility (a11y)
- [ ] Audit and add `aria-label` attributes to all icon buttons and interactive tags.
- [ ] Implement Dynamic Font Size slider adjusting base `rem` CSS rules.
- [ ] Ensure full keyboard tab-navigation support for desktop viewports.

## Phase 29: Deep Linking & SEO
- [ ] Configure Angular Router to handle deep links (`hellotalk://profile/:id`).
- [ ] Configure Angular Universal (SSR) for public Voiceroom preview pages.

## Phase 30: Media Pipeline Optimisation
- [ ] Implement client-side image compression (max 1080p) before R2 upload.
- [ ] Implement audio compression converting voice notes to lightweight `.m4a`/`.ogg`.

## Phase 31: Legal & GDPR Compliance
- [ ] Build dynamic Terms of Service and Privacy Policy document viewer.
- [ ] Implement "Download My Data" button triggering a NestJS JSON export worker.
- [ ] Build Account Deletion workflow with 30-day grace period.

## Phase 32: Custom Stickers & Emojis
- [ ] Build Sticker Store UI.
- [ ] Allow spending virtual coins to unlock animated sticker packs.
- [ ] Build custom sticker picker drawer inside chat window.

## Phase 33: User Analytics Dashboard
- [ ] Build "My Stats" dashboard tracking study hours, messages sent, and corrections made.
- [ ] Render visual charts using Chart.js inside Angular.

## Phase 34: UI Theming
- [ ] Build Theme Selector (Dark, Light, System Default).
- [ ] Allow VIP users to select custom primary accent colours.

## Phase 35: App Performance
- [ ] Implement Angular Lazy Loading for non-critical feature modules.
- [ ] Audit Web Vitals and optimize images using `loading="lazy"`.

## Phase 36: Backend Rate Limiting
- [ ] Configure NestJS `@nestjs/throttler` on sensitive authentication endpoints.
- [ ] Implement WebSocket connection rate limiting in Centrifugo.

## Phase 37: WebRTC Fallback Infrastructure
- [ ] Configure STUN/TURN server credentials in LiveKit for strict corporate NAT networks.

## Phase 38: Live Stream Viewer Mechanics
- [ ] Build scrolling live chat comment overlay over host video stream.
- [ ] Implement full-screen SVG gift animations when viewers tip the host.

## Phase 39: Live Stream Host Mechanics
- [ ] Build Host Dashboard showing live viewer count, earned coins, and stream uptime.
- [ ] Implement "Invite Co-Host" split-screen video layout.

## Phase 40: Moment Interactivity
- [ ] Build "Liked By" modal listing all users who liked a Moment.
- [ ] Implement `@mention` notifications when tagged in a comment.

## Phase 41: Language Assessment Test
- [ ] Build dynamic diagnostic quiz component for new sign-ups.
- [ ] Fetch multiple-choice assessment questions from backend database.

## Phase 42: Daily Check-in Rewards
- [ ] Build daily login modal granting 5 to 10 free virtual coins upon first daily login.

## Phase 43: Message Translation Toggle
- [ ] Cache translated text client-side to allow toggling between original and translation without extra API calls.

## Phase 44: Audio Auto-Play Settings
- [ ] Add settings toggle to auto-play sequential voice notes in chat.

## Phase 45: Image Gallery Viewer
- [ ] Build swipeable full-screen lightbox for Moments with multiple images.

## Phase 46: Partner Recommendation Algorithm
- [ ] Build NestJS background job calculating top 10 recommended language partners daily.

## Phase 47: Unread Badge Logic
- [ ] Implement global unread counter service updating app badge and navigation tabs.

## Phase 48: E2E Testing (Cypress)
- [ ] Setup Cypress inside `frontend/`.
- [ ] Write E2E test flows for Authentication, Chat Messaging, and Moment Creation.

## Phase 49: Unit Testing (Jest)
- [ ] Write NestJS unit tests for `DiscoveryService` PostGIS queries.
- [ ] Write Angular unit tests for `VocabularyStore` signals.

## Phase 50: Admin Dashboard (Users)
- [ ] Build Angular Admin Portal for user management.
- [ ] Build admin table to search users, inspect login history, and toggle VIP status manually.

## Phase 51: Admin Dashboard (Moderation)
- [ ] Build Moderation Queue UI to review flagged Moments and profiles.
- [ ] Implement 1-click ban and warning buttons.

## Phase 52: Help Centre
- [ ] Build in-app Help Centre fetching dynamic FAQ articles from backend.

## Phase 53: Version Enforcer
- [ ] Build NestJS endpoint returning minimum supported app version.
- [ ] Build blocking update modal in Angular if current app version is deprecated.

## Phase 54: Automated Code Formatting
- [ ] Configure Prettier and Husky git pre-commit hooks.

## Phase 55: GitHub Actions CI/CD
- [ ] Create `.github/workflows/deploy.yml` for automated testing and Docker image builds.

## Phase 56: Server Monitoring
- [ ] Configure Prometheus and Grafana Docker containers for NestJS and Centrifugo metrics.

## Phase 57: Global Error Handler
- [ ] Implement custom Angular `ErrorHandler` logging client crashes to backend analytics.

## Phase 58: Empty States
- [ ] Design custom vector illustrations for "No Messages", "No Moments Found", and "No Users Nearby".

## Phase 59: Input Sanitisation
- [ ] Implement strict HTML sanitisation using `DOMPurify` on all user-submitted text.

## Phase 60: Drafts System
- [ ] Persist unsent chat messages and Moment drafts to `localStorage`.

## Phase 61: Link Previews
- [ ] Build NestJS OpenGraph scraper rendering rich link preview cards in chat.

## Phase 62: System Messages
- [ ] Render custom system event bubbles in chat (e.g., "Profile updated", "Missed call").

## Phase 63: Account Recovery
- [ ] Build "Forgot Password" UI and NestJS email dispatch service.

## Phase 64: Self-Healing QA & Visual Refinement Loop
- [ ] AUTONOMOUS DIRECTIVE: Execute complete codebase audit. Verify zero hardcoded strings exist, confirm visual match against `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`, run test suites, and append any remaining visual bugs as new tasks below. Leave this box unchecked to loop continuously.

## Phase 65: Comprehensive App Settings, Legal, & Security Architecture

### Authentication & Account Security
- [ ] Build Social Login UI components (Google, Facebook, Apple OAuth buttons).
- [ ] Build "Linked Accounts" settings page to manage connected social accounts.
- [ ] Build Password Policy & Reset UI with real-time regex validation (min 8 chars, numbers, symbols).

### Appearance & UI Configuration
- [ ] Build "Appearance Settings" menu.
- [ ] Implement System-wide Dark Mode, Light Mode, and System Default toggle.
- [ ] Implement UI & Font Scaling slider adjusting base `rem` units across Angular.
- [ ] Build "Language Settings" menu to switch UI language independently of study target.

### Privacy, Blocking & Discoverability
- [ ] Build "Privacy Settings" hub.
- [ ] Implement "Who can see my profile" toggle (Everyone, VIPs only, Hidden).
- [ ] Build "User Filter Settings" to restrict initial message senders by age or native language.
- [ ] Build "Block Management" page to manage and unblock users.

### Notifications & Alerts
- [ ] Build unified "Notifications Area" (Inbox) for system alerts, likes, comments, and followers.
- [ ] Build "Notification Settings" toggles for Push Alerts and Badges across Direct Messages, Groups, Likes, and Voicerooms.

### Chat & Data Storage Settings
- [ ] Build "Chat Settings" page (Toggle Auto-Translate, Read Receipts, Enter-to-Send).
- [ ] Build "Data & Storage" page (Clear Local Cache, toggle cellular data auto-downloads).

### Legal, Help & GDPR Compliance
- [ ] Build "Help & About" page displaying App Version, build number, and open-source licences.
- [ ] Build "Legal & Privacy Notices" viewer for Terms of Service and Privacy Policy.
- [ ] Build "Personal Data Collection" GDPR hub with "Request My Data Archive" button and automated "Delete Account" workflow.

## Phase 66: Enhanced Profile & Matchmaking
- [ ] Add `proficiency_level` (`'a1'` to `'c2'`) to `users` table schema and profile UI.
- [ ] Implement proficiency level filter in Discovery search.
- [ ] Build "Interests" tagging UI in profile settings (e.g., "tech", "travel", "movies").
- [ ] Add "Interests" filter to Discovery search to match users with shared hobbies.
- [ ] Add "Learning Goals" free-text field to user profile to state user motivations.

## Phase 67: AI-Powered Learning Tools
- [ ] Design and build AI Conversation Partner chat interface.
- [ ] Implement NestJS service to proxy chat messages to a Large Language Model (e.g., GPT-4, Llama).
- [ ] Add "Explain this" context menu option on corrected text to get AI-generated grammar breakdown.
- [ ] Implement AI-generated suggested replies in chat based on conversation context.
- [ ] Build "Role-play" scenarios for AI chat (e.g., "ordering coffee", "job interview").

## Phase 68: Gamification & Engagement Hooks
- [ ] Design database schema for user achievements (`achievements` table, `user_achievements` join table).
- [ ] Build Achievements service in NestJS to award badges for milestones (e.g., "100 messages sent", "7-day streak").
- [ ] Build Achievements showcase page on user profiles.
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

## Phase 75: Advanced Voiceroom Interactivity
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
- [x] Document and file sharing (PDFs, spreadsheets, etc.).
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
- [ ] Build Terms of Service and Privacy Policy document viewers.

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