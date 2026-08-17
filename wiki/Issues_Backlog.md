# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Group Chat.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for 1-on-1 Chat.
- Edit sent messages within a specific time limit.
- Typing indicators and online status visibility.
- Add long-press context menu on mobile to copy, favourite, or report messages.
- Persist unsent chat messages and Moment drafts to `localStorage`.
- Implement the NestJS OpenGraph parser service: fetch URL, extract title/description/image with `cheerio` + `dompurify`, cache results, and expose `GET /link-preview?url=...` for the chat frontend.
- Search functionality within individual chats or across all conversations.
- Build Favourites bookmarking functionality: `POST /chat/favourites` in NestJS and `FavouritesComponent` in Angular to review saved messages and corrections.
- Disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- Build hold-to-record voice note recorder (`VoiceRecorderComponent`) in Angular with Cloudflare R2 direct upload and inline audio playback.
- Build NestJS endpoint (`POST /chat/token`) to mint Centrifugo connection JWTs with user sub claims.
- Chat archiving and hidden chat folders.
- Build Read Receipts (Sent vs Delivered vs Read checkmarks).
- Pin priority chats to the top of the inbox.
- Create GiftAnimationComponent and integrate it into chat/feed for gift payloads.
- Build Role-play scenarios for AI chat (e.g., ordering coffee, job interview).
- Fix QA test timeout: `Error: page.fill: Test timeout of 30000ms exceeded.` at `e2e/tests/adversarial/adversarial-chat-video.spec.ts:13` (`await page.fill(input, ...)` inside the shared `loginIfNeeded` helper, hit by every test in that spec...
- Fix `ChatRoomComponent.sendTextMessage()` (`frontend/src/app/components/chat-room/chat-room.component.ts:171`): it clears `textInput` and calls `draftsService.clearChatDraft()` _before_ `chatService.sendMessage` is awaited, with no restore in the `catch` block. A failed send (offline, server error, moderation rejection) currently loses the message text entirely instead of leaving it recoverable as a draft. Move the clear to after a successful send, matching the pattern already used correctly in `MomentsFeedComponent.submitMoment()`.
- Implement AI-powered Conversation Starter suggestions in new chat windows based on
- Design custom vector illustrations for No Messages, No Moments Found, and No Users Nearby.
- Add quick-action Send Message and Follow buttons on list items.
- Implement the actual caching logic in the frontend chat service/components (the provided diff only contained audio-room co-host changes).
- Add settings toggle to auto-play sequential voice notes in chat.
- Voice messages with playback speed control (1x, 1.5x, 2x).
- Reply to specific messages (swipe-to-reply gesture).
- Build Notification Settings toggles for Push Alerts and Badges across Direct Messages, Groups, Likes, and Voicerooms.
- Build AI Grammar Checker pre-send utility (`POST /nlp/grammar-check`) flagging sentence errors before sending in chat or moments.
- Build My Stats dashboard tracking study hours, messages sent, and corrections made.
- Message reactions using emojis.
- Implement WebSockets typing indicators (User is typing...).
- Real-time text messaging with delivery and read receipts (single tick, double tick, blue tick).
- Implement real-time text correction tools specifically designed to work within Group Chats (allowing members to correct each
- Render custom system event bubbles in chat (e.g., Profile updated, Missed call).
- Build HTML5 Canvas Doodle Pad component in chat modal.
- Build NestJS endpoint `POST /chat/messages` to validate messages, persist to Supabase `chat_messages` table, and publish to Centrifugo via HTTP API (`/api/publish`).
- Build Simplify this text AI feature in the message context menu for learners to understand complex sentences.
- Doodle message sharing.
- Build Angular 1-on-1 and Group Chat UI (`ChatRoomComponent`) with real-time message stream, typing indicators, and read receipts.
- Implement audio compression converting voice notes to lightweight `.m4a`/`.ogg`.
- Implement client-side and server-side (`pg_trgm`) message search inside chat rooms.
- Implement Who can message me filters (Age, Gender, Native Language).
- Build Achievements service in NestJS to award badges for milestones (e.g., 100 messages sent, 7-day streak).
- Implement Create Flashcard context menu option for any text selection within chat messages and moment posts.
- Starred messages for easy retrieval.
- Build HTML5 Canvas Doodle Tool component (`DoodlePadComponent`) in Angular allowing users to draw and transmit visual explanations.
- Fix QA test timeout: `Error: locator.fill: Test timeout of 30000ms exceeded.` waiting for `locator()`, e.g. `e2e/tests/adversarial/adversarial-chat.spec.ts:136` (`send message containing null byte`) and every other case in t...
- Write E2E test flows for Authentication, Chat Messaging, and Moment Creation.
- Build Chat Settings page (Toggle Auto-Translate, Read Receipts, Enter-to-Send).
- Instant video messages (short circular video notes).
- Implement Request Correction from Group feature/message type for group chats.
- Create system message integration (backend Centrifugo publish and frontend i18n bubble).
- Epic: Data Privacy: Automated PII scrubbing before sending chat text to Azure/DeepL
- Build scrolling live chat comment overlay over host video stream.
- End-to-end encryption for all personal messages and calls.
- Build direct Send Message and Follow action buttons on external profiles.
- Implement Voice-to-Text transcription next to audio messages.
- Build User Filter Settings to restrict initial message senders by age or native language.
- Build `system-message-bubble` component handling i18n keys system.profileUpdated, system.missedCall and wire to Centrifugo events.
- Identify and fix the specific test file causing ReferenceError: describe is not defined (need the failing test file path added to the chat).
- Implement IndexedDB message queuing for offline chat composition.
- Build NestJS OpenGraph scraper rendering rich link preview cards in chat.
- Build real-time text chat overlay inside live rooms.
- Epic: Offline Support: Implement IndexedDB PWA caching for LingQ offline reading and chat queueing
- Build a Groups Discovery tab within the chat interface for users to browse and join active group chats by topic.
- Build Group Chats feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests (e.g., Beginner French Grammar).
- Forwarding messages with a forwarded label to prevent spam.

## 👥 Group Chat

- Dedicated Groups & Scheduled Events System

## 📰 Moments & Social Feed

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments Feed.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles.
- Build Daily/Weekly Quests feature with coin rewards (e.g., Correct 3 moments today).
- Build a Serious Learner mode toggle that hides social feeds and prioritizes 1-on-1 matching based on strict language goals.
- Build Correction Quality rating system (up/down votes) for community corrections on Moments.
- Exempt non-user-authored body fields (client error `stack` traces in `LogClientErrorDto`, Apple/Google IAP webhook payloads) from the global `SanitiseHtmlPipe`, which currently strips angle-bracket content like `<anonymous>` and generic type params from stack traces before they reach analytics.
- Build AI Pronunciation Scoring service (`POST /nlp/pronunciation-score`) grading spoken audio out of 100 with phonetic breakdown.
- Build NestJS `DiscoveryController` PostGIS matching algorithm: Find users within customizable radius (`ST_DWithin`).
- Build Liked By modal listing all users who liked a Moment.
- Build Audio Intros feed in Discovery to browse users by listening to their spoken introductions.
- Build NestJS `FlashcardsController` endpoints (`POST /flashcards`, `PATCH /flashcards/:id/srs`) to save words and update review schedules.
- Build NestJS background worker (`TimelineWorker`) connected to Redis for fan-out processing (`RPUSH timeline_queue:{follower_id}`).
- Build Nearby Search PostGIS distance slider for VIP users.
- Build swipeable full-screen lightbox for Moments with multiple images.
- Build shared Voiceroom Notes panel where hosts/speakers can post key vocabulary or discussion topics.
- Build a centralized Events discovery feed for users to find upcoming scheduled activities.
- Implement Partner of the Week algorithm to highlight highly-rated language partners in the Discovery feed.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Build filtering endpoints for Moments feed: `All`, `Classmates` (same target language), and `Following`.
- Implement `@mention` notifications when tagged in a comment.
- use x-algorithm to power for you on the moments feed.
- Add a Mute Word client-side filter for the Moments feed to hide posts with specific keywords.
- Add haptic feedback for grading flashcards (e.g., success buzz for Known, gentle pulse for Learning).

## 👤 User Profiles & Settings

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Video Classrooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Tutor Profiles.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Settings.
- Admin portal: `AdminService.setVipStatus`/`banUser`/`warnUser` (frontend/src/app/services/admin.service.ts) already propagated real HTTP errors with no mock fallback (verified, not something this pass changed). The remaining gap was the missing client-side guard: `/admin` had no `canActivate`, so a non-admin who browsed there saw the fully populated mock user list before any mutation was attempted. Added `AdminService.checkAdminAccess()` (a real, no-mock-fallback call to `GET /admin/users`, which the
- Add `proficiency_level` (`a1` to `c2`) to `users` table schema and profile UI.
- Build Block Management page to manage and unblock users.
- Build Profile Cover Photo uploader with client-side cropping.
- Build Language Parties live audio rooms dedicated to spoken practice in a group setting.
- Build Appearance Settings menu.
- Build Create Group UI supporting up to 50 users.
- Implement Dynamic Font Size slider adjusting base `rem` CSS rules. (Added `FontScaleService` (`frontend/src/app/services/font-scale.service.ts`), which persists a 80-150% scale to `localStorage` and sets `document.documentElement.style.fontSize` so every Tailwind `rem` utility across the app scales together. Wired a slider into `SettingsComponent` under a new Accessibility section, and injected the service in `AppComponent` so the persisted scale applies on boot. Verified: `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` are clean, and `ng test --no-watch` passes 115/119 (28/28 spec files, 4 pre-existing skips) including the new `font-scale.service.spec.ts`. Follow-up review found `font-scale.service.ts` and `font-scale.service.spec.ts` were left untracked by git (`??`), so they were invisible to `git diff HEAD` and would have been silently dropped from the next commit even though `SettingsComponent`/`AppComponent` already depend on them; `git add`ed both to fix.)
- Implement a calendar view for users to track all their upcoming
- Implement a user-level Corrector Score based on ratings to display on profiles.
- Build Personal Data Collection GDPR hub with Request My Data Archive button and automated Delete Account workflow.
- Build Legal & Privacy Notices viewer for Terms of Service and Privacy Policy.
- Implement strict HTML sanitisation using `DOMPurify` on all user-submitted text.
- Build Linked Accounts settings page to manage connected social accounts.
- Build Angular Who Viewed Me component (`VisitorLogsComponent`): blur visitor avatars and names if user is on the free tier (`is_vip === false`), showing upgrade prompt for 8 UKP / $10 USD.
- Add Learning Goals free-text field to user profile to state user motivations.
- Restore backend `banUser` and `warnUser` endpoints (removed in the latest diff) so the admin-actions component can actually call them.
- Build Profile Cover Photo upload and positioning.
- Build dynamic Terms of Service and Privacy Policy document viewer.
- Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 annual equivalent): unlimited AI, 3 target languages, location spoofing, incognito profile views.
- Implement RSVP functionality allowing users to mark Attending or Interested.
- Build Privacy Settings hub.
- Build NestJS `ProfileVisitsService` to record profile views and query visitor logs (`GET /users/:id/visitors`).
- Build Angular Profile UI (`ProfileComponent`) with native/target language badges, audio intro player, and study streak display.
- Implement Translate Bio button on user profile cards and pages.
- Admin portal: `AdminService.setVipStatus`/`listUsers`/`getLoginHistory` (frontend/src/app/services/admin.service.ts) silently `catchError` into mock data on any HTTP failure, including a real 403 from the backend `AdminGuard`. Because the `/admin` route has no client-side guard, a non-admin who browses to it sees a fully populated fake user list, and clicking Grant/Revoke VIP appears to succeed even though no backend mutation happened. Surface real errors for admin actions instead of faking success (the mock fallback is fine for read-only browsing/demo mode, but not for a PATCH that changes VIP status).
- Build 30-second Audio Introduction recorder and playback card on profile.
- Build VIP Profile Visitor Log UI with blurred cards for free users.
- Add Voice Room Active filter to find users currently hosting streams.
- Configure Angular Router to handle deep links (`hellotalk://profile/:id`).
- Build Language Settings menu to switch UI language independently of study target.
- Build Angular Admin Portal for user management.
- Implement Who can see my profile toggle (Everyone, VIPs only, Hidden).
- Block and report users or businesses.
- Implement daily AI usage rate limiting in Redis (`daily_ai_usage:{user_id}:{date}`): cap at 10 requests/day for free users, unlimited for VIP (8 UKP / $10 USD per month).
- Add Interests filter to Discovery search to match users with shared hobbies.
- Allow VIP users to select custom primary accent colours.

## 🎙️ Live Audio Rooms & Video

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Classrooms.
- Implement Has Audio Intro required filter.
- Fix race condition where the `co_host_removed`/`co_host_invited` Centrifugo events published in `inviteCoHost` can arrive out of order (both are fire-and-forget, unawaited HTTP calls), and the
- Add AI-generated Session Summary to the archived audio room recording, listing key topics and vocabulary discussed.
- Build Incoming Call modal with ringtone audio and accept/reject controls.
- Implement the actual frontend Angular component for the swipeable full-screen lightbox .
- Epic: WebRTC Edge Cases: Handle Bluetooth headset interrupts and background audio state for LiveKit
- Build Private Parties feature (VIP/Pro tier) allowing invite-only audio rooms for specific friends or study partners.
- Configure Cloudflare R2 SDK (`@aws-sdk/client-s3`) in NestJS `MediaModule`. Create pre-signed URL upload endpoints for avatars and audio intros.
- Build Voiceroom Creation modal (Title, Language Pair, Topic).
- Fix `inviteCoHost` to demote/notify the existing co-host (and stop their publish) before assigning a new one, instead of silently overwriting `co_host_id`.
- Implement full-screen SVG gift animations when viewers tip the host.
- Build animated audio equalizer visualizer for active stage speakers.
- Categorise active Voicerooms by target language pair.
- The latest provided diff was still for audio-room co-hosts (`inviteCoHost`/`removeCoHost`), not the navigation tabs UI. Please provide the correct frontend changes.
- Build a Quick Poll feature for Voiceroom hosts to create multiple-choice questions for the audience.
- Configure Angular Universal (SSR) for public Voiceroom preview pages.
- Implement Invite Co-Host split-screen video layout.
- Add a Soundboard feature for hosts to play pre-recorded audio clips (e.g., applause, jingles).
- Implement Create Event modal requiring fields: Title (What), Date & Time (When), Platform/Location (Where - e.g., Audio Room, Zoom, In-person), and Description.
- Implement Raise Hand button and Approve Speaker modal for Hosts.
- Configure STUN/TURN server credentials in LiveKit for strict corporate NAT networks.
- Implement Host Moderation controls (Mute speaker, kick off stage).
- Photo and video sharing with an HD quality toggle.
- Integrate events with the Language Parties system, allowing scheduled audio rooms to automatically spin up at the designated time.
- The diff provided was STILL for audio-rooms co-hosts. Please actually write the Angular unit tests for VocabularyStore signals in frontend/src/app/services/vocabulary.store.spec.ts.
- Build Angular Audio Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- Complete 'Classrooms' & Tutor Marketplace Integration (italki Clone)
- Build click-to-translate & define pop-up modal (`WordDefinitionModalComponent`) in Angular with dictionary definitions and pronunciation audio.
- Epic: Media: Build HLS/DASH on-the-fly video transcoding for class replays
- Implement the actual background job (the provided diff was for audio-room co-hosts, not partner recommendations).

## 🔍 Discovery & Search

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery Map.
- Build GPS-based Nearby search rendering distance in miles or kilometres.
- Implement dynamic Hobbies & Interests tags mapped to target vocabulary.
- Build algorithmic Serious Learner filtering in discovery (`study_streak_days > 7` and `correction_ratio >= 0.8`).
- Guardian: repair stale Discovery Map Cypress assertions
- Build Angular Matchmaking & Discovery UI (`DiscoveryComponent`) with distance slider, language filters, and Serious Learner toggle.
- Build Recommended for You carousel based on mutual interests and activity levels.
- Implement VIP location spoofing logic in `DiscoveryService` (override real GPS coordinates with `mock_location` when `is_vip === true`).
- Build Global Search UI with translated dropdowns for Native Language, Target Language, and Level.
- Add Serious Learner toggle to filter for active study streaks.
- Design and implement a Pro subscription tier mimicking Tandem Pro (unlimited translations, advanced visitor logs, nearby members visibility, ad-free).

## 🧠 Learning, Vocabulary & AI Tools

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Spaced Repetition (SRS).
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for LingQ Engine.
- Epic: Exchange Mechanics: Enforce 50/50 language exchange timers in 1-on-1 calls to ensure reciprocal learning
- Implement Supabase JWT email/password and OAuth authentication service in Angular (`AuthService`).
- Build Forgot Password UI and NestJS email dispatch service.
- Implement backend endpoint for daily check-in coin reward and frontend modal UI.
- Build automated push notification reminders (e.g., Your Spanish Learning Event starts in 15 minutes).
- Build Flashcard Deck UI to organize saved vocabulary.
- Build NestJS `NlpModule` routing translation and transliteration requests to Azure AI / DeepL.
- Epic: Learning: Implement partial credit scoring for minor typos during SRS flashcard reviews
- Epic: Learning: Build a dedicated verb conjugation trainer and IPA alphabet module
- Epic: Security: Implement strict LLM prompt injection protection on all AI tools
- Epic: Gamification: Expand progress tracking with unlockable badges and detailed performance reports
- Epic: Compliance: Implement COPPA age-gating and an automated DMCA takedown request flow
- Fetch multiple-choice assessment questions from backend database.
- Build Suggest Flashcards feature to auto-detect and suggest new vocabulary from a
- Build NestJS background job calculating top 10 recommended language partners daily.
- Implement SRS review scheduling algorithm in NestJS.
- Create comprehensive `.env.example` and setup NestJS `@nestjs/config` environment schema validation (`Joi`/`Zod`) to fail-fast on missing keys or malformed URLs.
- Build Lessons module in Angular.
- Add Explain this context menu option on corrected text to get AI-generated grammar breakdown.
- Build daily login modal granting 5 to 10 free virtual coins upon first daily login.
- Wire `LinkPreviewModule` into the main `AppModule` imports array.
- Build interactive Flashcard Review UI (Flip animations and grading buttons).
- Allow spending virtual coins to unlock premium one-off AI services (e.g., Conversation Analysis Report).

## 👑 Monetisation & VIP

- Build Restore Purchases button for app store compliance.
- Integrate ngx-lottie or similar to render actual SVG animations for gifts.
- Allow spending virtual coins to unlock animated sticker packs.
- Epic: Economy Anti-Cheat: Server-side App Store receipt validation for coin purchases (e.g., verifying a 10 UKP / 12.50 USD transaction)
- Epic: State Management: Audit RxJS subscriptions and migrate to Angular Signals where possible to prevent memory leaks
- Add Restore Purchases workflow.
- Add Hide Online Status and Hide VIP Status toggles.
- Build Virtual Gift picker modal with coin balance auto-deduction.
- Build Language Challenge system with coin-based entry fees and prize pools (e.g., 7-day writing streak challenge).
- Build Developer Tier (20 UKP / $26 USD per month) API key management and developer analytics dashboard.
- Build Sticker Store UI.

## ✨ Feature Enhancements

- Implement custom JSON diff rendering (`VisualDiffComponent`) in Angular for language corrections (red strikethrough for original, green for fixed text).
- Epic: i18n & RTL: Comprehensive Arabic/Hebrew UI audit using logical properties
- Implement actual OpenGraph service using installed dependencies (cheerio, dompurify, jsdom).
- Build group participant drawer.
- Build blocking update modal in Angular if current app version is deprecated.
- Add Do Not Disturb scheduling.
- Implement custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Build dynamic diagnostic quiz component for new sign-ups.
- Cache translated text client-side to allow toggling between original and translation without extra API calls.
- Implement 1-click ban and warning buttons.
- Render visual charts using Chart.js inside Angular.
- Universal In-App Sharing & External Deep Linking Engine
- Build Data & Storage page (Clear Local Cache, toggle cellular data auto-downloads).
- build a new agent workflow to check for security issues and vulnerability
- Create `.github/workflows/deploy.yml` for automated testing and Docker image builds.
- Update `frontend/src/app/app.component.html` to visually render the unread badges using `unreadCounter.totalUnread()` (Requires HTML file).
- Implement client-side image compression (max 1080p) before R2 upload.
- Implement WebSocket connection rate limiting in Centrifugo.
- Build Help & About page displaying App Version, build number, and open-source licences.
- Implement Angular Lazy Loading for non-critical feature modules.
- End-to-end encrypted voice calls.
- Build Top Corrector community leaderboard.
- Build global No Network Connection banner component.
- Audit Web Vitals and optimize images using `loading=lazy`.
- Admin Portal, Compliance & Version Control
- Implement Dynamic Font Size slider adjusting base `rem` CSS rules.
- Implement in-app translations and language corrections with an interface mirroring
- Create `LinkPreviewModule`, `LinkPreviewController` and `LinkPreviewService` in `backend/src/link-preview/` that uses `jsdom`/`cheerio` to fetch a URL, extract OpenGraph tags, sanitise with DOMPurify, cache results for 1 hour, and expose `GET /link-preview?url=...`.
- Configure Angular Service Worker (`@angular/pwa`) for asset caching.
- Build the core `TokenisedTextComponent` in Angular using native `Intl.Segmenter` API (`granularity: word`) to render clickable tokens.
- Integrate UnreadCounterService into navigation tabs UI to display unread badges.
- Implement global unread counter service updating app badge and navigation tabs.
- Implement Who Viewed Me visitor logs.
- Initialise Angular frontend (`ng new frontend --style=scss --routing=true --ssr=false`).
- Hashtag & Topic Following System
- Build Account Deletion workflow with 30-day grace period.
- Implement frontend Angular component for the diagnostic quiz.
- Setup Centrifugo server configuration (`config.json`) and connect to Redis instance for pub/sub.
- Implement Download My Data button triggering a NestJS JSON export worker.
- Complete the implementation of the NestJS OpenGraph scraper and frontend rendering.
- Gamification, Retention & Habit Loops
- Build NestJS endpoint returning minimum supported app version.
- Rich link previews for URLs.
- Implement Word of the Day feature on the
- Ankii intergration
- Audit and add `aria-label` attributes to all icon buttons and interactive tags.
- Ensure full keyboard tab-navigation support for desktop viewports.
- Install `centrifuge-js` in Angular and build a resilient global `CentrifugeService` with reconnection and connection state signals.


- Epic: Mobile UX Audit: Fix PWA Safe Areas, Touch Targets, Viewport & Mobile Media Capabilities
  - **Issue:** The application acts like a responsive website instead of a true mobile social app. Needs comprehensive PWA/Mobile optimizations (safe-area-inset, touch targets, overscroll, media capture, modal back navigation, transitions, input modes).
