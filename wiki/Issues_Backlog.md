# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## 💬 1-on-1 Chat & Messaging

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for 1-on-1 Chat.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Chat.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Group Chat.
- Implement Request Correction from Group feature/message type for group chats.
- Forwarding messages with a forwarded label to prevent spam.
- Design custom vector illustrations for No Messages, No Moments Found, and No Users Nearby.
- Implement WebSockets typing indicators (User is typing...).
- Build scrolling live chat comment overlay over host video stream.
- Build Read Receipts (Sent vs Delivered vs Read checkmarks).
- Create GiftAnimationComponent and integrate it into chat/feed for gift payloads.
- Build Angular 1-on-1 and Group Chat UI (`ChatRoomComponent`) with real-time message stream, typing indicators, and read receipts.
- Implement the actual caching logic in the frontend chat service/components (the provided diff only contained audio-room co-host changes).
- Build direct Send Message and Follow action buttons on external profiles.
- Build `system-message-bubble` component handling i18n keys system.profileUpdated, system.missedCall and wire to Centrifugo events.
- Build Favourites bookmarking functionality: `POST /chat/favourites` in NestJS and `FavouritesComponent` in Angular to review saved messages and corrections.
- Implement Create Flashcard context menu option for any text selection within chat messages and moment posts.
- Build Chat Settings page (Toggle Auto-Translate, Read Receipts, Enter-to-Send).
- Build HTML5 Canvas Doodle Pad component in chat modal.
- Search functionality within individual chats or across all conversations.
- Build NestJS endpoint `POST /chat/messages` to validate messages, persist to Supabase `chat_messages` table, and publish to Centrifugo via HTTP API (`/api/publish`).
- Identify and fix the specific test file causing ReferenceError: describe is not defined (need the failing test file path added to the chat).
- Implement client-side and server-side (`pg_trgm`) message search inside chat rooms.
- Build a Groups Discovery tab within the chat interface for users to browse and join active group chats by topic.
- Message reactions using emojis.
- Implement IndexedDB message queuing for offline chat composition.
- Create system message integration (backend Centrifugo publish and frontend i18n bubble).
- Typing indicators and online status visibility.
- Build Role-play scenarios for AI chat (e.g., ordering coffee, job interview).
- Implement Who can message me filters (Age, Gender, Native Language).
- Reply to specific messages (swipe-to-reply gesture).
- Disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- Epic: Data Privacy: Automated PII scrubbing before sending chat text to Azure/DeepL
- Render custom system event bubbles in chat (e.g., Profile updated, Missed call).
- Add long-press context menu on mobile to copy, favourite, or report messages.
- Build My Stats dashboard tracking study hours, messages sent, and corrections made.
- Build hold-to-record voice note recorder (`VoiceRecorderComponent`) in Angular with Cloudflare R2 direct upload and inline audio playback.
- Build Notification Settings toggles for Push Alerts and Badges across Direct Messages, Groups, Likes, and Voicerooms.
- Write E2E test flows for Authentication, Chat Messaging, and Moment Creation.
- Starred messages for easy retrieval.
- Implement real-time text correction tools specifically designed to work within Group Chats (allowing members to correct each
- Chat archiving and hidden chat folders.
- Build Achievements service in NestJS to award badges for milestones (e.g., 100 messages sent, 7-day streak).
- Build Group Chats feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests (e.g., Beginner French Grammar).
- Persist unsent chat messages and Moment drafts to `localStorage`.
- Build User Filter Settings to restrict initial message senders by age or native language.
- Implement audio compression converting voice notes to lightweight `.m4a`/`.ogg`.
- Instant video messages (short circular video notes).
- Build Simplify this text AI feature in the message context menu for learners to understand complex sentences.
- Implement Voice-to-Text transcription next to audio messages.
- Voice messages with playback speed control (1x, 1.5x, 2x).
- Build NestJS endpoint (`POST /chat/token`) to mint Centrifugo connection JWTs with user sub claims.
- Doodle message sharing.
- Real-time text messaging with delivery and read receipts (single tick, double tick, blue tick).
- Add settings toggle to auto-play sequential voice notes in chat.
- Epic: Offline Support: Implement IndexedDB PWA caching for LingQ offline reading and chat queueing
- Implement the NestJS OpenGraph parser service: fetch URL, extract title/description/image with `cheerio` + `dompurify`, cache results, and expose `GET /link-preview?url=...` for the chat frontend.
- Edit sent messages within a specific time limit.
- Build HTML5 Canvas Doodle Tool component (`DoodlePadComponent`) in Angular allowing users to draw and transmit visual explanations.
- Build NestJS OpenGraph scraper rendering rich link preview cards in chat.
- Pin priority chats to the top of the inbox.
- End-to-end encryption for all personal messages and calls.
- Build real-time text chat overlay inside live rooms.
- Add quick-action Send Message and Follow buttons on list items.
- Implement AI-powered Conversation Starter suggestions in new chat windows based on
- Build AI Grammar Checker pre-send utility (`POST /nlp/grammar-check`) flagging sentence errors before sending in chat or moments.

## 👥 Group Chat

- Dedicated Groups & Scheduled Events System

## 📰 Moments & Social Feed

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Moments Feed.
- Build shared Voiceroom Notes panel where hosts/speakers can post key vocabulary or discussion topics.
- Build a Serious Learner mode toggle that hides social feeds and prioritizes 1-on-1 matching based on strict language goals.
- Build filtering endpoints for Moments feed: `All`, `Classmates` (same target language), and `Following`.
- Build Correction Quality rating system (up/down votes) for community corrections on Moments.
- Build NestJS `FlashcardsController` endpoints (`POST /flashcards`, `PATCH /flashcards/:id/srs`) to save words and update review schedules.
- Build NestJS `DiscoveryController` PostGIS matching algorithm: Find users within customizable radius (`ST_DWithin`).
- Exempt non-user-authored body fields (client error `stack` traces in `LogClientErrorDto`, Apple/Google IAP webhook payloads) from the global `SanitiseHtmlPipe`, which currently strips angle-bracket content like `<anonymous>` and generic type params from stack traces before they reach analytics.
- Build NestJS background worker (`TimelineWorker`) connected to Redis for fan-out processing (`RPUSH timeline_queue:{follower_id}`).
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Build AI Pronunciation Scoring service (`POST /nlp/pronunciation-score`) grading spoken audio out of 100 with phonetic breakdown.
- Build Daily/Weekly Quests feature with coin rewards (e.g., Correct 3 moments today).
- Add a Mute Word client-side filter for the Moments feed to hide posts with specific keywords.
- Implement `@mention` notifications when tagged in a comment.
- Build Nearby Search PostGIS distance slider for VIP users.
- Build swipeable full-screen lightbox for Moments with multiple images.
- use x-algorithm to power for you on the moments feed.
- Implement Partner of the Week algorithm to highlight highly-rated language partners in the Discovery feed.
- Build Liked By modal listing all users who liked a Moment.
- Build a centralized Events discovery feed for users to find upcoming scheduled activities.
- Add haptic feedback for grading flashcards (e.g., success buzz for Known, gentle pulse for Learning).
- Build Audio Intros feed in Discovery to browse users by listening to their spoken introductions.

## 👤 User Profiles & Settings

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Tutor Profiles.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Profiles.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Video Classrooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for User Settings.
- Build Angular Who Viewed Me component (`VisitorLogsComponent`): blur visitor avatars and names if user is on the free tier (`is_vip === false`), showing upgrade prompt for 8 UKP / $10 USD.
- Build Language Parties live audio rooms dedicated to spoken practice in a group setting.
- Implement a calendar view for users to track all their upcoming
- Build Personal Data Collection GDPR hub with Request My Data Archive button and automated Delete Account workflow.
- Configure Angular Router to handle deep links (`hellotalk://profile/:id`).
- Add `proficiency_level` (`a1` to `c2`) to `users` table schema and profile UI.
- Implement a user-level Corrector Score based on ratings to display on profiles.
- Restore backend `banUser` and `warnUser` endpoints (removed in the latest diff) so the admin-actions component can actually call them.
- Build Angular Profile UI (`ProfileComponent`) with native/target language badges, audio intro player, and study streak display.
- Implement daily AI usage rate limiting in Redis (`daily_ai_usage:{user_id}:{date}`): cap at 10 requests/day for free users, unlimited for VIP (8 UKP / $10 USD per month).
- Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 annual equivalent): unlimited AI, 3 target languages, location spoofing, incognito profile views.
- Build dynamic Terms of Service and Privacy Policy document viewer.
- Add Interests filter to Discovery search to match users with shared hobbies.
- Implement Who can see my profile toggle (Everyone, VIPs only, Hidden).
- Allow VIP users to select custom primary accent colours.
- Add Learning Goals free-text field to user profile to state user motivations.
- Add Voice Room Active filter to find users currently hosting streams.
- Build Privacy Settings hub.
- Implement strict HTML sanitisation using `DOMPurify` on all user-submitted text.
- Build Profile Cover Photo uploader with client-side cropping.
- Build Create Group UI supporting up to 50 users.
- Build Block Management page to manage and unblock users.
- Build Angular Admin Portal for user management.
- Build VIP Profile Visitor Log UI with blurred cards for free users.
- Implement Dynamic Font Size slider adjusting base `rem` CSS rules. (Added `FontScaleService` (`frontend/src/app/services/font-scale.service.ts`), which persists a 80-150% scale to `localStorage` and sets `document.documentElement.style.fontSize` so every Tailwind `rem` utility across the app scales together. Wired a slider into `SettingsComponent` under a new Accessibility section, and injected the service in `AppComponent` so the persisted scale applies on boot. Verified: `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` are clean, and `ng test --no-watch` passes 115/119 (28/28 spec files, 4 pre-existing skips) including the new `font-scale.service.spec.ts`. Follow-up review found `font-scale.service.ts` and `font-scale.service.spec.ts` were left untracked by git (`??`), so they were invisible to `git diff HEAD` and would have been silently dropped from the next commit even though `SettingsComponent`/`AppComponent` already depend on them; `git add`ed both to fix.)
- Build NestJS `ProfileVisitsService` to record profile views and query visitor logs (`GET /users/:id/visitors`).
- Implement RSVP functionality allowing users to mark Attending or Interested.
- Admin portal: `AdminService.setVipStatus`/`listUsers`/`getLoginHistory` (frontend/src/app/services/admin.service.ts) silently `catchError` into mock data on any HTTP failure, including a real 403 from the backend `AdminGuard`. Because the `/admin` route has no client-side guard, a non-admin who browses to it sees a fully populated fake user list, and clicking Grant/Revoke VIP appears to succeed even though no backend mutation happened. Surface real errors for admin actions instead of faking success (the mock fallback is fine for read-only browsing/demo mode, but not for a PATCH that changes VIP status).
- Build 30-second Audio Introduction recorder and playback card on profile.
- Build Appearance Settings menu.
- Build Legal & Privacy Notices viewer for Terms of Service and Privacy Policy.
- Build Language Settings menu to switch UI language independently of study target.
- Admin portal: `AdminService.setVipStatus`/`banUser`/`warnUser` (frontend/src/app/services/admin.service.ts) already propagated real HTTP errors with no mock fallback (verified, not something this pass changed). The remaining gap was the missing client-side guard: `/admin` had no `canActivate`, so a non-admin who browsed there saw the fully populated mock user list before any mutation was attempted. Added `AdminService.checkAdminAccess()` (a real, no-mock-fallback call to `GET /admin/users`, which the
- Build Linked Accounts settings page to manage connected social accounts.
- Implement Translate Bio button on user profile cards and pages.
- Block and report users or businesses.
- Build Profile Cover Photo upload and positioning.

## 🎙️ Live Audio Rooms & Video

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Audio Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Live Rooms.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Classrooms.
- Build Voiceroom Creation modal (Title, Language Pair, Topic).
- Categorise active Voicerooms by target language pair.
- The latest provided diff was still for audio-room co-hosts (`inviteCoHost`/`removeCoHost`), not the navigation tabs UI. Please provide the correct frontend changes.
- Implement full-screen SVG gift animations when viewers tip the host.
- Configure Angular Universal (SSR) for public Voiceroom preview pages.
- Epic: Media: Build HLS/DASH on-the-fly video transcoding for class replays
- Complete 'Classrooms' & Tutor Marketplace Integration (italki Clone)
- Build click-to-translate & define pop-up modal (`WordDefinitionModalComponent`) in Angular with dictionary definitions and pronunciation audio.
- Epic: WebRTC Edge Cases: Handle Bluetooth headset interrupts and background audio state for LiveKit
- Build animated audio equalizer visualizer for active stage speakers.
- Build Private Parties feature (VIP/Pro tier) allowing invite-only audio rooms for specific friends or study partners.
- Implement the actual frontend Angular component for the swipeable full-screen lightbox .
- Configure STUN/TURN server credentials in LiveKit for strict corporate NAT networks.
- Integrate events with the Language Parties system, allowing scheduled audio rooms to automatically spin up at the designated time.
- Configure Cloudflare R2 SDK (`@aws-sdk/client-s3`) in NestJS `MediaModule`. Create pre-signed URL upload endpoints for avatars and audio intros.
- Build Incoming Call modal with ringtone audio and accept/reject controls.
- Implement Has Audio Intro required filter.
- Build Angular Audio Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- Add a Soundboard feature for hosts to play pre-recorded audio clips (e.g., applause, jingles).
- Implement the actual background job (the provided diff was for audio-room co-hosts, not partner recommendations).
- Implement Raise Hand button and Approve Speaker modal for Hosts.
- Implement Create Event modal requiring fields: Title (What), Date & Time (When), Platform/Location (Where - e.g., Audio Room, Zoom, In-person), and Description.
- Implement Host Moderation controls (Mute speaker, kick off stage).
- Add AI-generated Session Summary to the archived audio room recording, listing key topics and vocabulary discussed.
- Photo and video sharing with an HD quality toggle.
- The diff provided was STILL for audio-rooms co-hosts. Please actually write the Angular unit tests for VocabularyStore signals in frontend/src/app/services/vocabulary.store.spec.ts.
- Build a Quick Poll feature for Voiceroom hosts to create multiple-choice questions for the audience.
- Implement Invite Co-Host split-screen video layout.

## 🔍 Discovery & Search

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Discovery Map.
- Build GPS-based Nearby search rendering distance in miles or kilometres.
- Build algorithmic Serious Learner filtering in discovery (`study_streak_days > 7` and `correction_ratio >= 0.8`).
- Build Global Search UI with translated dropdowns for Native Language, Target Language, and Level.
- Build Angular Matchmaking & Discovery UI (`DiscoveryComponent`) with distance slider, language filters, and Serious Learner toggle.
- Implement dynamic Hobbies & Interests tags mapped to target vocabulary.
- Guardian: repair stale Discovery Map Cypress assertions
- Implement VIP location spoofing logic in `DiscoveryService` (override real GPS coordinates with `mock_location` when `is_vip === true`).
- Add Serious Learner toggle to filter for active study streaks.
- Design and implement a Pro subscription tier mimicking Tandem Pro (unlimited translations, advanced visitor logs, nearby members visibility, ad-free).
- Build Recommended for You carousel based on mutual interests and activity levels.

## 🧠 Learning, Vocabulary & AI Tools

- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for LingQ Engine.
- **Stabilization:** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling, testing (Vitest, Cypress), and monitoring (Datadog/Prometheus) for Spaced Repetition (SRS).
- Build NestJS `NlpModule` routing translation and transliteration requests to Azure AI / DeepL.
- Implement Supabase JWT email/password and OAuth authentication service in Angular (`AuthService`).
- Epic: Compliance: Implement COPPA age-gating and an automated DMCA takedown request flow
- Fetch multiple-choice assessment questions from backend database.
- Build interactive Flashcard Review UI (Flip animations and grading buttons).
- Epic: Exchange Mechanics: Enforce 50/50 language exchange timers in 1-on-1 calls to ensure reciprocal learning
- Build NestJS background job calculating top 10 recommended language partners daily.
- Create comprehensive `.env.example` and setup NestJS `@nestjs/config` environment schema validation (`Joi`/`Zod`) to fail-fast on missing keys or malformed URLs.
- Build Suggest Flashcards feature to auto-detect and suggest new vocabulary from a
- Allow spending virtual coins to unlock premium one-off AI services (e.g., Conversation Analysis Report).
- Build automated push notification reminders (e.g., Your Spanish Learning Event starts in 15 minutes).
- Epic: Learning: Build a dedicated verb conjugation trainer and IPA alphabet module
- Build Lessons module in Angular.
- Build daily login modal granting 5 to 10 free virtual coins upon first daily login.
- Build Forgot Password UI and NestJS email dispatch service.
- Wire `LinkPreviewModule` into the main `AppModule` imports array.
- Build Flashcard Deck UI to organize saved vocabulary.
- Implement backend endpoint for daily check-in coin reward and frontend modal UI.
- Implement SRS review scheduling algorithm in NestJS.
- Epic: Learning: Implement partial credit scoring for minor typos during SRS flashcard reviews
- Add Explain this context menu option on corrected text to get AI-generated grammar breakdown.
- Epic: Security: Implement strict LLM prompt injection protection on all AI tools
- Epic: Gamification: Expand progress tracking with unlockable badges and detailed performance reports

## 👑 Monetisation & VIP

- Integrate ngx-lottie or similar to render actual SVG animations for gifts.
- Add Hide Online Status and Hide VIP Status toggles.
- Epic: State Management: Audit RxJS subscriptions and migrate to Angular Signals where possible to prevent memory leaks
- Build Virtual Gift picker modal with coin balance auto-deduction.
- Epic: Economy Anti-Cheat: Server-side App Store receipt validation for coin purchases (e.g., verifying a 10 UKP / 12.50 USD transaction)
- Build Language Challenge system with coin-based entry fees and prize pools (e.g., 7-day writing streak challenge).
- Allow spending virtual coins to unlock animated sticker packs.
- Add Restore Purchases workflow.
- Build Sticker Store UI.
- Build Developer Tier (20 UKP / $26 USD per month) API key management and developer analytics dashboard.
- Build Restore Purchases button for app store compliance.

## ✨ Feature Enhancements

- Create `.github/workflows/deploy.yml` for automated testing and Docker image builds.
- Implement client-side image compression (max 1080p) before R2 upload.
- Implement Angular Lazy Loading for non-critical feature modules.
- Configure Angular Service Worker (`@angular/pwa`) for asset caching.
- Gamification, Retention & Habit Loops
- Hashtag & Topic Following System
- Create `LinkPreviewModule`, `LinkPreviewController` and `LinkPreviewService` in `backend/src/link-preview/` that uses `jsdom`/`cheerio` to fetch a URL, extract OpenGraph tags, sanitise with DOMPurify, cache results for 1 hour, and expose `GET /link-preview?url=...`.
- Build Top Corrector community leaderboard.
- End-to-end encrypted voice calls.
- Implement Download My Data button triggering a NestJS JSON export worker.
- Implement 1-click ban and warning buttons.
- Build dynamic diagnostic quiz component for new sign-ups.
- Admin Portal, Compliance & Version Control
- Cache translated text client-side to allow toggling between original and translation without extra API calls.
- Implement Who Viewed Me visitor logs.
- Render visual charts using Chart.js inside Angular.
- Implement in-app translations and language corrections with an interface mirroring
- Universal In-App Sharing & External Deep Linking Engine
- Add Do Not Disturb scheduling.
- Implement actual OpenGraph service using installed dependencies (cheerio, dompurify, jsdom).
- Build NestJS endpoint returning minimum supported app version.
- Update `frontend/src/app/app.component.html` to visually render the unread badges using `unreadCounter.totalUnread()` (Requires HTML file).
- Build Help & About page displaying App Version, build number, and open-source licences.
- Build Data & Storage page (Clear Local Cache, toggle cellular data auto-downloads).
- Implement custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Build blocking update modal in Angular if current app version is deprecated.
- Ensure full keyboard tab-navigation support for desktop viewports.
- Implement Dynamic Font Size slider adjusting base `rem` CSS rules.
- Integrate UnreadCounterService into navigation tabs UI to display unread badges.
- Rich link previews for URLs.
- Build group participant drawer.
- Build the core `TokenisedTextComponent` in Angular using native `Intl.Segmenter` API (`granularity: word`) to render clickable tokens.
- build a new agent workflow to check for security issues and vulnerability
- Audit and add `aria-label` attributes to all icon buttons and interactive tags.
- Build Account Deletion workflow with 30-day grace period.
- Complete the implementation of the NestJS OpenGraph scraper and frontend rendering.
- Implement global unread counter service updating app badge and navigation tabs.
- Implement Word of the Day feature on the
- Implement WebSocket connection rate limiting in Centrifugo.
- Implement frontend Angular component for the diagnostic quiz.
- Ankii intergration
- Implement custom JSON diff rendering (`VisualDiffComponent`) in Angular for language corrections (red strikethrough for original, green for fixed text).
- Initialise Angular frontend (`ng new frontend --style=scss --routing=true --ssr=false`).
- Epic: i18n & RTL: Comprehensive Arabic/Hebrew UI audit using logical properties
- Setup Centrifugo server configuration (`config.json`) and connect to Redis instance for pub/sub.
- Audit Web Vitals and optimize images using `loading=lazy`.
- Install `centrifuge-js` in Angular and build a resilient global `CentrifugeService` with reconnection and connection state signals.
- Build global No Network Connection banner component.

