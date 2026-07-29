- [x] Fix QA test timeout: `Error: page.fill: Test timeout of 30000ms exceeded.` at `e2e/tests/adversarial/adversarial-chat-video.spec.ts:13` (`await page.fill('input[name="email"]', ...)` inside the shared `loginIfNeeded` helper, hit by every test in that spec via `test.beforeEach`). Root cause: the app has no login/auth route at all, `frontend/src/app/app.routes.ts:5-185` contains no `path: 'auth/login'` (or any `login`) route, and there is no login component anywhere under `frontend/src/app` (confirmed via search for `*login*`/`*auth*` components, `frontend/src/app/services/auth.service.ts` and `frontend/src/app/core/auth.service.ts` are just services, not routed pages). So `page.goto('/auth/login')` in `loginIfNeeded` hits an unmatched route with no `email`/`password` inputs ever rendered, and `page.fill('input[name="email"]', ...)` polls forever until the 30s timeout. Fix by either (a) implementing the missing `/auth/login` standalone page/component with `input[name="email"]`, `input[name="password"]` and a `button[type="submit"]` that authenticates via `auth.service.ts` and navigates to `/chat` on success, and registering its route in `app.routes.ts`, or (b) if auth is intentionally out of scope for this build and the app is always "logged in", update `loginIfNeeded` in `adversarial-chat-video.spec.ts` to skip navigating to a non-existent login route. Rerun the QA suite to confirm the timeout is gone.
- [STUCK] Fix QA test timeout: `Error: locator.fill: Test timeout of 30000ms exceeded.` waiting for `locator('[data-testid="message-input"]')`, e.g. `e2e/tests/adversarial/adversarial-chat.spec.ts:136` (`send message containing null byte`) and every other case in that spec that does `page.locator('[data-testid="message-input"]').fill(...)`. Root cause: `frontend/src/app/components/chat-room/chat-room.component.html:318-324` renders the message text `<input>` with no `data-testid` attribute at all, only the adjacent send button (line 328) has `data-testid="send-button"`, so the locator never resolves and every `.fill()` call times out. Fix by adding `data-testid="message-input"` to the `<input>` at chat-room.component.html:318, then rerun the QA suite to confirm the timeout is gone.
- [STUCK] Fix QA test timeout: locator.waitFor exceeded 30s
- [x] Fix QA test failure: `[WebServer] Partner search failed: HttpErrorResponse {`. Logged from `frontend/src/app/components/discovery/discovery.component.ts:124` (`searchPartners`'s catch block). Root cause is in `frontend/src/app/services/safety.service.ts:186-193`: `getBlockedAndBlockerIds` does `return firstValueFrom(...)` inside a `try` block without `await`ing it, so when the underlying `GET /safety/blocked-and-blocker-ids/:userId` call rejects, the function has already returned the (still-pending) promise and the `catch` never executes; the rejection then propagates uncaught out of `discovery.service.ts`'s `findPartners` (which calls `this.safetyService.getBlockedAndBlockerIds(...)` at line 59 with no error handling around it, unlike the `partners` HTTP call above it which is wrapped in `catchError`) and surfaces as an unhandled `HttpErrorResponse` in the component. Fix by adding `await` before `firstValueFrom(...)` in `getBlockedAndBlockerIds` so the existing `try/catch` actually catches HTTP failures (returning `[]` as intended), and/or wrap the `getBlockedAndBlockerIds` call in `findPartners` with its own error handling so a safety-service outage cannot break partner search entirely. Rerun the QA suite to confirm the error is gone.
- [STUCK] Fix QA test failure: backend unreachable during E2E (ECONNREFUSED). Root cause: `npm run start:dev` (nest start --watch) has slow compilation, backend sometimes crashes on config init before frontend dev server makes first HTTP call. This is an infrastructure/E2E config issue, not an application code bug. The qa-loop.sh already checks `curl http://localhost:3000/api/health` and skips if backend is down. Fix suggestion: change e2e/playwright.config.ts webServer command from `npm run start:dev` to `npm run build && node dist/main` and add a longer timeout.

# TODO.md (Master HelloTalk Clone Architecture: Phases 1 to 79 + Phase C)

## URGENT

1. `frontend/src/app/components/hobby-tags/hobby-tags.component.ts`: `userVocabulary` signal retyped from `unknown[]` to the service's real `VocabularyItem[]` interface (`word`, `translation`, `hobbyTagName`); template updated to only reference fields that actually exist on it, and the now-unused `getDifficultyColour` helper was removed.
2. `frontend/src/app/components/virtual-gift-modal/virtual-gift-modal.component.ts`: added the missing `TranslatePipe` to the standalone component's `imports` array, resolving `NG8004: No pipe found with name 't'`.
   Verified: `cd frontend && npm run build` completes with no errors, and `ng serve` reaches "Application bundle generation complete" well inside Playwright's 120s `webServer.timeout`.

## GLOBAL ARCHITECTURAL RULES

- **RULE 1:** ABSOLUTELY NO HARD-CODED DATA. All content, user profiles, and UI copy must be fetched dynamically or piped through `@ngx-translate`.
- **RULE 2:** STRICT i18n (`@ngx-translate`). No raw text strings allowed inside Angular HTML templates.
- **RULE 3:** PIXEL-PERFECT CLONING. Every UI component must be visually verified against the `original-hello-talk-screenshots/` directory.

---

## Phase 1: Repository Setup & Infrastructure Initialisation

## Phase 2: User Profiles, PostGIS Matchmaking & Visitor Tracking

## Phase 3: Centrifugo Real-Time Chat Engine & Interactive Payloads

## Phase 4: LingQ Interactive Reading Engine & AI/NLP Utilities

## Phase 5: Global Social Feed ("Moments") with Redis Fan-Out

## Phase 6: Live Audio & Video Rooms (LiveKit SFU)

- Listener clicks "Raise Hand" (`POST /audio-rooms/raise-hand`).
- Host receives notification and calls `POST /audio-rooms/approve-speaker`.
- NestJS calls `AccessToken` API to issue refreshed JWT with `canPublish: true`.

## Phase 7: VIP Monetisation, Virtual Economy & Trust/Safety

## Phase 8: Audit Remediation & Security Lockdown

- [ ] Replace mock returns in `backend/src/nlp/nlp.service.ts` with real DeepL and Azure AI API calls.

## Phase 9: Internationalisation (i18n) Foundation

## Phase 10: The Moments Engine (Feed & Media)

## Phase 11: In-App NLP & Learning Utilities

## Phase 12: Matchmaking & Discovery UI

## Phase 13: HelloTalk Chat Specifics

## Phase 14: Live Audio Voicerooms UI

## Phase 15: Advanced User Profiles

- [ ] Implement dynamic Hobbies & Interests tags mapped to target vocabulary.
- [ ] Build Profile Cover Photo uploader with client-side cropping.

## Phase 16: Live Chat Micro-Interactions

- [ ] Add long-press context menu on mobile to copy, favourite, or report messages.

## Phase 17: Audio & Video Calling (WebRTC / LiveKit)

- [ ] Build Incoming Call modal with ringtone audio and accept/reject controls.
- [ ] Implement active VoIP Call UI (Mute, Speakerphone, End Call).
- [ ] Build 1-on-1 Video Call interface with local preview overlay.

## Phase 18: Monetisation & VIP Tiers

- [ ] Build VIP Subscription showcase page detailing all premium benefits.
- [ ] Integrate Stripe Checkout for Monthly (8 UKP / $10 USD) and Yearly (50 UKP / $63 USD) plans.
- [ ] Build "Restore Purchases" button for app store compliance.

## Phase 19: Gamification & Study Streaks

- [ ] Build Daily Study Streak counter widget on home screen.
- [ ] Implement NestJS CRON job to reset streaks if inactive for 24 hours.
- [ ] Build "Top Corrector" community leaderboard.

## Phase 20: Spaced Repetition (SRS) Flashcards

## Phase 21: Push Notifications

- [ ] Integrate Firebase Cloud Messaging (FCM) in Angular.
- [ ] Build NestJS event listeners to dispatch push alerts for chats, comments, and profile views.
- [ ] Build Notification Preferences UI with granular category toggles.

## Phase 22: Moderation & Trust Engine

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

## Phase 26: Group Chats

## Phase 27: Offline Support & PWA

- [x] Run `ng add @angular/pwa` in the `frontend` directory to generate service worker configuration.

## Phase 28: Accessibility (a11y)

## Phase 29: Deep Linking & SEO

- [x] Run `ng add @angular/ssr` in the `frontend` directory to generate server files.
- [x] Update `server.ts` to handle `/voiceroom-preview/:id` routes.
- [x] The previous commit only fixed a linting error in the component; the actual SSR scaffolding (`ng add @angular/ssr`) still needs to be executed.

## Phase 30: Media Pipeline Optimisation

- [ ] Integrate ImageCompressionService into the R2 upload flow (e.g., in MediaService or component upload handlers).
  - [x] Update VoiceRecorderComponent to call compressAudio before uploading.

## Phase 31: Legal & GDPR Compliance

## Phase 32: Custom Stickers & Emojis

- [ ] Build custom sticker picker drawer inside chat window.

## Phase 33: User Analytics Dashboard

- [ ] Implement backend endpoints for user statistics.

## Phase 34: UI Theming

- [ ] Build Theme Selector (Dark, Light, System Default).

## Phase 35: App Performance

## Phase 36: Backend Rate Limiting

## Phase 37: WebRTC Fallback Infrastructure

## Phase 38: Live Stream Viewer Mechanics

## Phase 39: Live Stream Host Mechanics

- [ ] Build Host Dashboard showing live viewer count, earned coins, and stream uptime.

## Phase 40: Moment Inter interactivity

## Phase 41: Language Assessment Test

## Phase 42: Daily Check-in Rewards

## Phase 43: Message Translation Toggle

## Phase 44: Audio Auto-Play Settings

- [x] Create SettingsService to persist auto-play preference.
- [x] Add UI toggle in SettingsComponent.
- [x] Update ChatRoomComponent to listen for audio 'ended' events and play the next voice note if enabled.

## Phase 45: Image Gallery Viewer

## Phase 46: Partner Recommendation Algorithm

## Phase 47: Unread Badge Logic

## Phase 48: E2E Testing (Cypress)

## Phase 49: Unit Testing (Jest)

## Phase 50: Admin Dashboard (Users)

## Phase 51: Admin Dashboard (Moderation)

## Phase 52: Help Centre

- [ ] Build in-app Help Centre fetching dynamic FAQ articles from backend.

## Phase 53: Version Enforcer

## Phase 54: Automated Code Formatting

## Phase 55: GitHub Actions CI/CD

## Phase 56: Server Monitoring

## Phase 57: Global Error Handler

## Phase 58: Empty States

## Phase 59: Input Sanitisation

## Phase 60: Drafts System

## Phase 61: Link Previews

## Phase 62: System Messages

## Phase 63: Account Recovery

- [ ] Build "Forgot Password" UI and NestJS email dispatch service.

## Phase 64: Self-Healing QA & Visual Refinement Loop

- [ ] AUTONOMOUS DIRECTIVE: Execute complete codebase audit. Verify zero hardcoded strings exist, confirm visual match against `original-hello-talk-screenshots/`, run test suites, and append any remaining visual bugs as new tasks below. Leave this box unchecked to loop continuously.

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

### 2. Media & File Sharing

### 3. Audio & Video Calls

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

- [ ] View once media (photos/videos that disappear after being opened).
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
