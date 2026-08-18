# 📋 Consolidated Product Backlog

*Organized by complete user outcomes rather than individual technical chores.*

## Real-Time Communication & Messaging

- Add long-press context menu on mobile to copy, favourite, or report messages.
- Add quick-action Send Message and Follow buttons on list items.
- Add settings toggle to auto-play sequential voice notes in chat.
- Build AI Grammar Checker pre-send utility (`POST /nlp/grammar-check`) flagging sentence errors before sending in chat or moments.
- Build Achievements service in NestJS to award badges for milestones (e.g., 100 messages sent, 7-day streak).
- Build Angular 1-on-1 and Group Chat UI (`ChatRoomComponent`) with real-time message stream, typing indicators, and read receipts.
- Build Chat Settings page (Toggle Auto-Translate, Read Receipts, Enter-to-Send).
- Build Create Group UI supporting up to 50 users.
- Build Favourites bookmarking functionality:   `POST /chat/favourites` in NestJS and `FavouritesComponent` in Angular to review saved messages and...
- Build Group Chats feature allowing 2 to 19 partners to collaborate in a single thread based on specific interests (e.g., Beginner French Grammar).
- Build HTML5 Canvas Doodle Pad component in chat modal.
- Build Language Parties live audio rooms dedicated to spoken practice in a group setting.
- Build My Stats dashboard tracking study hours, messages sent, and corrections made.
- Build NestJS OpenGraph scraper rendering rich link preview cards in chat.
- Build NestJS endpoint (`POST /chat/token`) to mint Centrifugo connection JWTs with user sub claims.
- Build NestJS endpoint `POST /chat/messages` to validate messages, persist to Supabase `chat_messages` table, and publish to Centrifugo via HTTP API (`/api/publish`).
- Build Notification Settings toggles for Push Alerts and Badges across Direct Messages, Groups, Likes, and Voicerooms.
- Build Role-play scenarios for AI chat (e.g., ordering coffee, job interview).
- Build Simplify this text AI feature in the message context menu for learners to understand complex sentences.
- Build User Filter Settings to restrict initial message senders by age or native language.
- Build `system-message-bubble` component handling i18n keys system.profileUpdated, system.missedCall and wire to Centrifugo events.
- Build a Groups Discovery tab within the chat interface for users to browse and join active group chats by topic.
- Build direct Send Message and Follow action buttons on external profiles.
- Build group participant drawer.
- Build hold-to-record voice note recorder (`VoiceRecorderComponent`) in Angular with Cloudflare R2 direct upload and inline audio playback.
- Build real-time text chat overlay inside live rooms.
- Build scrolling live chat comment overlay over host video stream.
- Chat archiving and hidden chat folders.
- Create GiftAnimationComponent and integrate it into chat/feed for gift payloads.
- Create system message integration (backend Centrifugo publish and frontend i18n bubble).
- Dedicated Groups & Scheduled Events System
- Design custom vector illustrations for No Messages, No Moments Found, and No Users Nearby.
- Disappearing messages (set to expire after 24 hours, 7 days, or 90 days).
- Doodle message sharing.
- Edit sent messages within a specific time limit.
- End-to-end encryption for all personal messages and calls.
- Epic: Data Privacy: Automated PII scrubbing before sending chat text to Azure/DeepL
- Forwarding messages with a forwarded label to prevent spam.
- Implement AI-powered Conversation Starter suggestions in new chat windows based on
- Implement Create Flashcard context menu option for any text selection within chat messages and moment posts.
- Implement Request Correction from Group feature/message type for group chats.
- Implement Voice-to-Text transcription next to audio messages.
- Implement Who can message me filters (Age, Gender, Native Language).
- Implement audio compression converting voice notes to lightweight `.m4a`/`.ogg`.
- Implement client-side and server-side (`pg_trgm`) message search inside chat rooms.
- Implement real-time text correction tools specifically designed to work within Group Chats (allowing members to correct each
- Implement the actual caching logic in the frontend chat service/components (the provided diff only contained audio-room co-host changes).
- Instant video messages (short circular video notes).
- Message reactions using emojis.
- Persist unsent chat messages and Moment drafts to `localStorage`.
- Pin priority chats to the top of the inbox.
- Render custom system event bubbles in chat (e.g., Profile updated, Missed call).
- Reply to specific messages (swipe-to-reply gesture).
- Search functionality within individual chats or across all conversations.
- Starred messages for easy retrieval.
- Voice messages with playback speed control (1x, 1.5x, 2x).
- Write E2E test flows for Authentication, Chat Messaging, and Moment Creation.

## Social Feed & Community Engagement

- Add Do Not Disturb scheduling.
- Add a Mute Word client-side filter for the Moments feed to hide posts with specific keywords.
- Add haptic feedback for grading flashcards (e.g., success buzz for Known, gentle pulse for Learning).
- Ankii intergration
- Audit Web Vitals and optimize images using `loading=lazy`.
- Audit and add `aria-label` attributes to all icon buttons and interactive tags.
- Build AI Pronunciation Scoring service (`POST /nlp/pronunciation-score`) grading spoken audio out of 100 with phonetic breakdown.
- Build Audio Intros feed in Discovery to browse users by listening to their spoken introductions.
- Build Correction Quality rating system (up/down votes) for community corrections on Moments.
- Build Daily/Weekly Quests feature with coin rewards (e.g., Correct 3 moments today).
- Build Forgot Password UI and NestJS email dispatch service.
- Build HTML5 Canvas Doodle Tool component (`DoodlePadComponent`) in Angular allowing users to draw and transmit visual explanations.
- Build Help & About page displaying App Version, build number, and open-source licences.
- Build Incoming Call modal with ringtone audio and accept/reject controls.
- Build Lessons module in Angular.
- Build Liked By modal listing all users who liked a Moment.
- Build Nearby Search PostGIS distance slider for VIP users.
- Build NestJS `DiscoveryController` PostGIS matching algorithm: Find users within customizable radius (`ST_DWithin`).
- Build NestJS `FlashcardsController` endpoints (`POST /flashcards`, `PATCH /flashcards/:id/srs`) to save words and update review schedules.
- Build NestJS background job calculating top 10 recommended language partners daily.
- Build NestJS endpoint returning minimum supported app version.
- Build Recommended for You carousel based on mutual interests and activity levels.
- Build Sticker Store UI.
- Build Top Corrector community leaderboard.
- Build a Serious Learner mode toggle that hides social feeds and prioritizes 1-on-1 matching based on strict language goals.
- Build a centralized Events discovery feed for users to find upcoming scheduled activities.
- Build dynamic diagnostic quiz component for new sign-ups.
- Build filtering endpoints for Moments feed: `All`, `Classmates` (same target language), and `Following`.
- Build shared Voiceroom Notes panel where hosts/speakers can post key vocabulary or discussion topics.
- Build swipeable full-screen lightbox for Moments with multiple images.
- Build the core `TokenisedTextComponent` in Angular using native `Intl.Segmenter` API (`granularity: word`) to render clickable tokens.
- Build unified Notifications Area (Inbox) for system alerts, likes, comments, and followers.
- Complete 'Classrooms' & Tutor Marketplace Integration (italki Clone)
- Complete the implementation of the NestJS OpenGraph scraper and frontend rendering.
- Configure Cloudflare R2 SDK (`@aws-sdk/client-s3`) in NestJS `MediaModule`. Create pre-signed URL upload endpoints for avatars and audio intros.
- Create comprehensive `.env.example` and setup NestJS `@nestjs/config` environment schema validation (`Joi`/`Zod`) to fail-fast on missing keys or malformed URLs.
- End-to-end encrypted voice calls.
- Ensure full keyboard tab-navigation support for desktop viewports.
- Epic: Compliance: Implement COPPA age-gating and an automated DMCA takedown request flow
- Epic: i18n & RTL: Comprehensive Arabic/Hebrew UI audit using logical properties
- Exempt non-user-authored body fields (client error `stack` traces in `LogClientErrorDto`, Apple/Google IAP webhook payloads) from the global `SanitiseHtmlPipe`, which currently strips angle-bracket content like `<anonymous>` and generic type params from stack traces before they reach analytics.
- Gamification, Retention & Habit Loops
- Hashtag & Topic Following System
- Implement Angular Lazy Loading for non-critical feature modules.
- Implement Dynamic Font Size slider adjusting base `rem` CSS rules.
- Implement Has Audio Intro required filter.
- Implement Partner of the Week algorithm to highlight highly-rated language partners in the Discovery feed.
- Implement RSVP functionality allowing users to mark Attending or Interested.
- Implement Supabase JWT email/password and OAuth authentication service in Angular (`AuthService`).
- Implement Who Viewed Me visitor logs.
- Implement Word of the Day feature on the
- Implement `@mention` notifications when tagged in a comment.
- Implement a calendar view for users to track all their upcoming
- Implement actual OpenGraph service using installed dependencies (cheerio, dompurify, jsdom).
- Implement client-side image compression (max 1080p) before R2 upload.
- Implement custom Angular `ErrorHandler` logging client crashes to backend analytics.
- Implement custom JSON diff rendering (`VisualDiffComponent`) in Angular for language corrections (red strikethrough for original, green for fixed text).
- Implement frontend Angular component for the diagnostic quiz.
- Implement global unread counter service updating app badge and navigation tabs.
- Implement strict HTML sanitisation using `DOMPurify` on all user-submitted text.
- Implement the actual frontend Angular component for the swipeable full-screen lightbox .
- Initialise Angular frontend (`ng new frontend --style=scss --routing=true --ssr=false`).
- Install `centrifuge-js` in Angular and build a resilient global `CentrifugeService` with reconnection and connection state signals.
- Integrate UnreadCounterService into navigation tabs UI to display unread badges.
- Integrate ngx-lottie or similar to render actual SVG animations for gifts.
- Render visual charts using Chart.js inside Angular.
- Rich link previews for URLs.
- Setup Centrifugo server configuration (`config.json`) and connect to Redis instance for pub/sub.
- Typing indicators and online status visibility.
- Universal In-App Sharing & External Deep Linking Engine
- Wire `LinkPreviewModule` into the main `AppModule` imports array.
- use x-algorithm to power for you on the moments feed.

## User Discovery & Matchmaking

- Add Interests filter to Discovery search to match users with shared hobbies.
- Build Angular Matchmaking & Discovery UI (`DiscoveryComponent`) with distance slider, language filters, and Serious Learner toggle.
- Build GPS-based Nearby search rendering distance in miles or kilometres.
- Build Global Search UI with translated dropdowns for Native Language, Target Language, and Level.
- Build algorithmic Serious Learner filtering in discovery (`study_streak_days > 7` and `correction_ratio >= 0.8`).
- Design and implement a Pro subscription tier mimicking Tandem Pro (unlimited translations, advanced visitor logs, nearby members visibility, ad-free).
- Guardian: repair stale Discovery Map Cypress assertions
- Implement VIP location spoofing logic in `DiscoveryService` (override real GPS coordinates with `mock_location` when `is_vip === true`).

## Live Audio & Video Events

- Add AI-generated Session Summary to the archived audio room recording, listing key topics and vocabulary discussed.
- Add Voice Room Active filter to find users currently hosting streams.
- Add a Soundboard feature for hosts to play pre-recorded audio clips (e.g., applause, jingles).
- Build Angular Audio Room UI (`AudioRoomComponent`) displaying Host, Speaker Stage Grid, and Listener Audience Grid.
- Build Private Parties feature (VIP/Pro tier) allowing invite-only audio rooms for specific friends or study partners.
- Build Read Receipts (Sent vs Delivered vs Read checkmarks).
- Build Voiceroom Creation modal (Title, Language Pair, Topic).
- Build a Quick Poll feature for Voiceroom hosts to create multiple-choice questions for the audience.
- Build animated audio equalizer visualizer for active stage speakers.
- Categorise active Voicerooms by target language pair.
- Configure Angular Universal (SSR) for public Voiceroom preview pages.
- Configure STUN/TURN server credentials in LiveKit for strict corporate NAT networks.
- Epic: Media: Build HLS/DASH on-the-fly video transcoding for class replays
- Epic: WebRTC Edge Cases: Handle Bluetooth headset interrupts and background audio state for LiveKit
- Fix `inviteCoHost` to demote/notify the existing co-host (and stop their publish) before assigning a new one, instead of silently overwriting `co_host_id`.
- Fix race condition where the `co_host_removed`/`co_host_invited` Centrifugo events published in `inviteCoHost` can arrive out of order (both are fire-and-forget, unawaited HTTP calls), and the
- Implement Create Event modal requiring fields:  Title (What), Date & Time (When), Platform/Location (Where - e.g., Audio Room, Zoom, In-person),...
- Implement Host Moderation controls (Mute speaker, kick off stage).
- Implement Invite Co-Host split-screen video layout.
- Implement Raise Hand button and Approve Speaker modal for Hosts.
- Implement full-screen SVG gift animations when viewers tip the host.
- Integrate events with the Language Parties system, allowing scheduled audio rooms to automatically spin up at the designated time.
- Photo and video sharing with an HD quality toggle.
- Real-time text messaging with delivery and read receipts (single tick, double tick, blue tick).

## Interactive Learning & AI Tools

- Add Explain this context menu option on corrected text to get AI-generated grammar breakdown.
- Add Learning Goals free-text field to user profile to state user motivations.
- Add Serious Learner toggle to filter for active study streaks.
- Allow spending virtual coins to unlock premium one-off AI services (e.g., Conversation Analysis Report).
- Build Flashcard Deck UI to organize saved vocabulary.
- Build NestJS `NlpModule` routing translation and transliteration requests to Azure AI / DeepL.
- Build Suggest Flashcards feature to auto-detect and suggest new vocabulary from a
- Build automated push notification reminders (e.g., Your Spanish Learning Event starts in 15 minutes).
- Build click-to-translate & define pop-up modal (`WordDefinitionModalComponent`) in Angular with dictionary definitions and pronunciation audio.
- Build interactive Flashcard Review UI (Flip animations and grading buttons).
- Epic: Exchange Mechanics: Enforce 50/50 language exchange timers in 1-on-1 calls to ensure reciprocal learning
- Epic: Learning: Build a dedicated verb conjugation trainer and IPA alphabet module
- Epic: Learning: Implement partial credit scoring for minor typos during SRS flashcard reviews
- Implement SRS review scheduling algorithm in NestJS.
- Implement Translate Bio button on user profile cards and pages.
- Implement daily AI usage rate limiting in Redis (`daily_ai_usage: {user_id}...
- Implement dynamic Hobbies & Interests tags mapped to target vocabulary.
- Implement in-app translations and language corrections with an interface mirroring

## Monetisation & Premium Features

- Add Hide Online Status and Hide VIP Status toggles.
- Allow VIP users to select custom primary accent colours.
- Allow spending virtual coins to unlock animated sticker packs.
- Build Angular Who Viewed Me component (`VisitorLogsComponent`):  blur visitor avatars and names if user is on the free tier (`is_vip ===...
- Build Developer Tier (20 UKP / $26 USD per month) API key management and developer analytics dashboard.
- Build Language Challenge system with coin-based entry fees and prize pools (e.g., 7-day writing streak challenge).
- Build Restore Purchases button for app store compliance.
- Build VIP Profile Visitor Log UI with blurred cards for free users.
- Build Virtual Gift picker modal with coin balance auto-deduction.
- Build daily login modal granting 5 to 10 free virtual coins upon first daily login.
- Enforce consumer VIP benefits across API (8 UKP / $10 USD per month or 6 UKP / $8 annual equivalent):   unlimited AI, 3 target languages, location spoofing, incognito profile views.......
- Epic: Economy Anti-Cheat: Server-side App Store receipt validation for coin purchases (e.g., verifying a 10 UKP / 12.50 USD transaction)
- Epic: State Management: Audit RxJS subscriptions and migrate to Angular Signals where possible to prevent memory leaks
- Implement Who can see my profile toggle (Everyone, VIPs only, Hidden).
- Implement backend endpoint for daily check-in coin reward and frontend modal UI.

## Trust, Safety & User Privacy

- Add `proficiency_level` (`a1` to `c2`) to `users` table schema and profile UI.
- Admin Portal, Compliance & Version Control
- Block and report users or businesses.
- Build 30-second Audio Introduction recorder and playback card on profile.
- Build Angular Admin Portal for user management.
- Build Angular Profile UI (`ProfileComponent`) with native/target language badges, audio intro player, and study streak display.
- Build Appearance Settings menu.
- Build Block Management page to manage and unblock users.
- Build Language Settings menu to switch UI language independently of study target.
- Build Legal & Privacy Notices viewer for Terms of Service and Privacy Policy.
- Build Linked Accounts settings page to manage connected social accounts.
- Build NestJS `ProfileVisitsService` to record profile views and query visitor logs (`GET /users/:id/visitors`).
- Build Privacy Settings hub.
- Build Profile Cover Photo upload and positioning.
- Build Profile Cover Photo uploader with client-side cropping.
- Build blocking update modal in Angular if current app version is deprecated.
- Build dynamic Terms of Service and Privacy Policy document viewer.
- Build global No Network Connection banner component.
- Configure Angular Router to handle deep links (`hellotalk://profile/:id`).
- Epic: Gamification: Expand progress tracking with unlockable badges and detailed performance reports
- Implement 1-click ban and warning buttons.
- Implement a user-level Corrector Score based on ratings to display on profiles.
- Restore backend `banUser` and `warnUser` endpoints (removed in the latest diff) so the admin-actions component can actually call them.

## Platform Stability & Core Architecture

- **Stabilization: ** Complete technical foundation, security audits (GDPR, RLS), performance optimization (Caching, Rate Limiting), error handling,...
- Add Restore Purchases workflow.
- Build Account Deletion workflow with 30-day grace period.
- Build Data & Storage page (Clear Local Cache, toggle cellular data auto-downloads).
- Build NestJS background worker (`TimelineWorker`) connected to Redis for fan-out processing (`RPUSH timeline_queue:{follower_id}`).
- Build Personal Data Collection GDPR hub with Request My Data Archive button and automated Delete Account workflow.
- Cache translated text client-side to allow toggling between original and translation without extra API calls.
- Configure Angular Service Worker (`@angular/pwa`) for asset caching.
- Create `.github/workflows/deploy.yml` for automated testing and Docker image builds.
- Epic: Offline Support: Implement IndexedDB PWA caching for LingQ offline reading and chat queueing
- Epic: Security: Implement strict LLM prompt injection protection on all AI tools
- Fetch multiple-choice assessment questions from backend database.
- Implement Download My Data button triggering a NestJS JSON export worker.
- Implement IndexedDB message queuing for offline chat composition.
- Implement WebSocket connection rate limiting in Centrifugo.
- Implement WebSockets typing indicators (User is typing...).
- Implement the NestJS OpenGraph parser service:   fetch URL, extract title/description/image with `cheerio` + `dompurify`, cache results, and expose `GET...
- build a new agent workflow to check for security issues and vulnerability

