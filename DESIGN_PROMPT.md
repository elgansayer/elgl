# EXHAUSTIVE SYSTEM ARCHITECTURE & UI/UX DESIGN SPECIFICATION: THE ULTIMATE LANGUAGE PLATFORM

## 1. Executive Summary & Foundational Constraints

### 1.1 Project Overview

Generate the complete, production-ready frontend architecture and UI component library for a massive social language learning platform. This platform merges the social discovery and messaging of HelloTalk, the interactive tokenised reading and SRS flashcards of LingQ, and the structured, monetised tutor marketplace of italki.

### 1.2 Strict UI/UX Directives

- **Framework:** Angular (Standalone Components, Signals for state, `@if`/`@for` control flow).
- **Styling Engine:** Tailwind CSS. Strictly use logical CSS properties (`ps-`, `pe-`, `ms-`, `me-`, `border-s`, `text-start`) for flawless Right-To-Left (RTL) language mirroring.
- **Visual Aesthetic:** Premium "Dark Mode First". Deep obsidian backgrounds (`bg-[#121212]`), slate elevated containers (`bg-surface-100`), vibrant neon purple/mint primary actions, and dense horizontal scrollable pills.
- **Accessibility & UX:** Minimum 44px touch targets on mobile, full ARIA roles, skeleton loaders for ALL async data, empty states for ALL lists, and keyboard tab-index navigability.
- **Localisation (i18n):** ZERO hardcoded strings. All text pipes through `{{ 'key' | t }}`.
- **Monetisation Display:** You MUST always display monetary values in dual currencies simultaneously globally (e.g., "8 UKP / 10.00 USD").
- **Resilience:** Offline PWA fallbacks (IndexedDB caching), graceful degradation, and strict DOMPurify HTML sanitization for all user-generated content.

---

## 2. Design System & Global Primitives

Every screen is constructed from these exact primitive components:

### 2.1 Buttons & Controls

- **`app-button-primary`**: Full-width or inline button, bold text, neon purple gradient background, scales down 95% on active click, heavy drop shadow.
- **`app-button-secondary`**: Transparent background with a 1px solid border of the primary color, used for secondary actions (e.g., "Cancel", "Skip").
- **`app-gradient-button`**: Multi-color stop gradient for premium/VIP actions (e.g., Gold to Orange).
- **`app-scrollable-pills`**: Horizontal scrolling container (`overflow-x-auto`, hidden scrollbar). Contains `app-pill` components used for filters (e.g., "Spanish", "Beginner", "Nearby").

### 2.2 Data Inputs & Forms

- **`app-input` & `app-textarea`**: Floating label inputs with a dark slate background (`bg-surface-200`), 2px focus ring, and an integrated trailing icon slot for clear/show-password actions.
- **`app-language-picker`**: Bottom-sheet modal containing a searchable, grouped list of global languages with their respective SVG national flags.
- **`app-emoji-picker` / `app-sticker-picker`**: Grid-based overlay categorizing animated WebP stickers and standard emojis.

### 2.3 Visual Indicators

- **`app-fluency-indicator`**: A compact, segmented progress bar (1 to 6 blocks) sitting next to a language flag, denoting CEFR levels (A1 to C2).
- **`app-audio-equalizer`**: Three vertical animated bars that oscillate randomly while a voice note is playing.
- **`app-skeleton-loaders`**: Shimmering grey blocks (`animate-pulse bg-surface-300`) matching the exact shape of the data they replace while loading.
- **`app-empty-state`**: Centered flex container featuring a large, soft-colored SVG illustration, a title, a descriptive subtitle, and a primary Call-to-Action button.
- **`app-toast`**: Floating snackbar at the top-center of the screen with success/error colors, automatically dismissing after 3 seconds.

---

## 3. Exhaustive Screen & Module Specifications

### Module 1: Authentication, Onboarding & Security

- **Onboarding Wizard (`onboarding-wizard`)**: A full-screen 5-step carousel.
  - _Step 1:_ Select Native Language (Grid of large buttons with flags).
  - _Step 2:_ Select Target Language.
  - _Step 3:_ Self-assess CEFR level via a slider (`A1` to `C2`).
  - _Step 4:_ Choose study goals via multi-select pills (e.g., "Travel", "Business", "Exams").
  - _Step 5:_ Account creation (Email/Password or Social OAuth).
  - _Tooltips:_ Contextual popovers explain what CEFR means to new users.
- **Device Lock (`device-lock`)**: A blurred full-screen overlay with a 4-digit PIN pad. Numbers 0-9 rendered as large circular buttons. A biometric fallback button (Fingerprint/FaceID icon) sits below.
- **Password Flows (`forgot-password`, `reset-password`, `change-password`)**: Minimalist centered cards containing a single `app-input` and a submit button.
- **Data Lifecycle (`account-deletion`, `gdpr`)**: A specialized, red-tinted danger zone interface requiring the user to type "DELETE" into an input box to confirm account erasure. Includes a "Request My Data JSON" export button.

### Module 2: Advanced Discovery & Matchmaking

- **Discovery Map View (`discovery`)**: A full-screen Mapbox/Leaflet integration. Shows clustered user avatars as map markers based on PostGIS proximity.
- **Discovery Feed View**: A vertical feed of user cards. Each card displays an avatar, name, native/target flag badges, and a "Say Hi" quick-message button.
- **Filter Drawer**: A bottom sheet containing:
  - `age-range-slider`: Dual-thumb slider (18 to 99).
  - `distance-slider`: Logarithmic slider (1km to Global).
  - Toggles for "Online Only" and "VIP Only".
- **Study Buddy Matcher (`study-buddy`)**: A Tinder-esque swipeable card stack interface for finding dedicated, long-term language partners based on strict complementary metrics.
- **Interests Select (`hobby-tags`, `interests-select`, `topic-following`)**: A dense tag-cloud interface where users tap chips to subscribe to topics (e.g., #Anime, #JLPT, #Cooking), dynamically altering their discovery algorithm.

### Module 3: "Moments" Social Feed & Content

- **Moments Feed (`moments-feed`)**: A timeline of posts. Each post contains:
  - Header: User avatar, name, timestamp.
  - Body: Text content (sanitized via DOMPurify), and up to 9 images in a masonry grid (`image-lightbox`), or a voice note with a waveform.
  - Footer: Like, Comment, Share, and "Correct" buttons.
- **Visual Diff Corrections (`correction-modal`, `visual-diff`)**:
  - _Interaction:_ User taps "Correct" on a Moment.
  - _UI:_ A split-screen text editor. Top is the original text, bottom is the user's correction.
  - _Rendering:_ Output uses `diff-match-patch`. Deletions are wrapped in `<del>` with red backgrounds and strikethroughs; insertions in `<ins>` with green backgrounds.
- **Interactive Context Elements (`moment-translate`, `word-definition-modal`, `cultural-tip`)**: Tapping any text pops up a floating tooltip containing a DeepL translation, dictionary definition, or an AI-generated cultural context tip.

### Module 4: Chat & Direct Messaging

- **Chat List (`chat-list`)**: Vertical list of active conversations. Each row shows a circular avatar with an online status dot, name, a 1-line message preview, and a neon unread message count badge. Supports IndexedDB offline caching.
- **Chat Room Canvas (`chat-room`)**:
  - _Header:_ User info and Voice/Video call buttons.
  - _Scroll Area:_ Chat bubbles. Left-aligned (grey) for received, right-aligned (purple) for sent.
  - _System Bubbles (`chat-system-bubble`):_ Centered, small text indicating dates or "Missed Call" events.
- **Rich Attachments**:
  - `voice-recorder`: A push-to-talk button that expands into a recording visualizer.
  - `doodle-pad`: A fullscreen HTML5 canvas overlay allowing users to finger-draw a message with basic color selectors.
  - `sticker-store`: A horizontally scrolling tabbed drawer of animated WebP stickers.
- **Message Context Menus (`message-context-menu`)**: Long-pressing a chat bubble opens an iOS-style haptic popup menu with options: "Reply", "Copy", "Translate", "Pronounce (TTS)", "Correct", "Save to Vocabulary".
- **VoIP Calling (`video-call`, `active-call`, `incoming-call-modal`)**: Fullscreen WebRTC interfaces with blurred avatar backgrounds, glowing pulsing rings for incoming calls, and mute/speaker/end-call pill buttons.

### Module 5: Live Audio Rooms ("Language Parties")

- **Room Lobby (`audio-rooms`, `language-parties`)**: A dashboard of active rooms. Features a horizontal `scrollable-pills` filter (Topic, Language, Size). Room cards display a large host avatar and overlapping smaller audience avatars, with a pulsing red "LIVE" badge.
- **Stage UI (`audio-stage`, `split-screen-video`)**:
  - _Top Half:_ The "Stage". The host and approved co-hosts appear as large avatars (or video tiles). Active speakers have a thick glowing green border.
  - _Bottom Half:_ The "Audience". A dense grid of smaller avatars representing listeners.
  - _Action Bar:_ "Raise Hand" button, "Leave Quietly" button, "Send Gift" button.
- **Interactive Room Overlays**:
  - `live-chat-overlay`: A transparent, auto-scrolling chat overlay situated on the bottom-left of the stage.
  - `gift-animation-overlay`: When a user tips, a full-screen Lottie/SVG animation plays (e.g., fireworks, floating hearts).
  - `voiceroom-notes`: A shared scratchpad where the host can type vocabulary for the room.
  - `soundboard`: Host-only grid of buttons to trigger MP3 sound effects (applause, laugh track) to all listeners.

### Module 6: Interactive Reading & SRS Engine (LingQ Style)

- **Tokenised Text (`tokenised-text`)**: Long-form articles where _every single word_ is processed via `Intl.Segmenter` and rendered as a clickable `<span>`.
- **SRS Color Coding**:
  - Level 0 (Unknown): Highlighted Light Blue.
  - Level 1-3 (Learning): Highlighted Yellow.
  - Level 4 (Known): No highlight (transparent).
- **Language Hub (`vocabulary-dashboard`, `word-of-the-day`)**: A dashboard tracking known words. Includes a spaced-repetition flashcard player (`suggest-flashcards`) where users flip cards and rate their memory (1-4).
- **Audio Sync Reader (`audio-sync-reader`)**: A media player at the bottom of the screen. As the audio plays, the current sentence in the text above is highlighted with a grey background, utilizing time-stamped transcription data.

### Module 7: Classrooms & Tutor Marketplace

- **Tutor Discovery (`classrooms-marketplace`)**: A grid of professional teachers and community tutors. Each card has a 16:9 intro video thumbnail, star rating, hourly rate (Dual Currency: 15 UKP / 19.00 USD), and language pairs taught.
- **Lesson Manager (`lesson-manager`, `lessons`)**: A calendar UI for booking slots. Integrates timezone conversion logic.
- **Virtual Classroom**: A specialized WebRTC layout featuring a split-screen video feed on the left and a collaborative rich-text document/whiteboard on the right for lesson notes.

### Module 8: User Profiles, Gamification & Stats

- **Profile Views (`profile`, `user-detail`, `business-profile`)**:
  - Cover photo header (`cover-photo-uploader`).
  - Avatar with online status ring.
  - Bio, translated text blocks, and dynamic `fluency-indicator` badges.
- **Social Graph**: `follow-list` tabs for Followers/Following, and a `profile-visitors` list showing who recently viewed the profile.
- **Gamification Engine**:
  - `study-streak-counter`: A persistent flame icon in the top header showing consecutive days active.
  - `streak-celebration-overlay`: A massive confetti explosion when a streak milestone (e.g., 7 days) is hit.
  - `daily-login-modal`: A modal that pops up on first launch of the day, rewarding the user with virtual coins.
  - `earned-badges`, `leaderboard`, `milestone`, `quests`: Interfaces displaying SVG shields, progress bars for daily tasks (e.g., "Send 5 messages in Spanish"), and global ranking tables.

### Module 9: Settings, Trust & Safety

- **Settings Dashboard (`settings`)**: A standard iOS-style list of configuration rows with chevron arrows.
- **Appearance (`appearance-settings`, `theme-selector`, `font-scale-slider`)**: Toggles for Dark/Light mode and an input range slider to dynamically adjust the app's base font size (rem scaling).
- **Trust & Safety (`moderation-queue`, `report-user-modal`)**: Flow for users to report inappropriate behavior, including selecting a reason and attaching screenshots. For admins, the `moderation-queue` displays pending reports with "Approve" (Ban) or "Reject" (Dismiss) buttons.
- **Legal (`help-centre`, `terms`, `privacy`)**: Document viewers for static legal text, fully localized.

### Module 10: Monetisation & Virtual Economy

- **VIP Subscription (`vip`, `subscription-plans`, `my-subscription`)**: A pricing table showing Free vs VIP tiers. MUST display prices like "8 UKP / 10.00 USD per month". Highlights features like "No Ads", "Unlimited Translations".
- **Virtual Shop (`shop`, `cart`, `coins-success`, `coins-cancel`)**: A grid of coin bundles (e.g., "100 Coins for 1 UKP / 1.25 USD"). Includes a checkout flow and success/cancel callback screens.
- **Gifting Ecosystem (`virtual-gift-modal`, `gift-picker`, `host-dashboard`)**: A bottom sheet where users can spend their coin balance on animated gifts to send to Moments or Audio Room hosts. The `host-dashboard` allows creators to track their received gift revenue.

---

## 4. Implementation Expectations

When requested to build or modify any part of this system, you must deliver:

1.  **Strict Component Architecture:** Perfect adherence to the exact component names and module boundaries listed above.
2.  **State & Data Handling:** Native Angular Signals (`signal`, `computed`), RxJS `resource()` for async API calls, and zero `as` TypeScript casts. Must include IndexedDB caching logic for offline capabilities.
3.  **UI/UX Fidelity:** 100% implementation of the specified layouts, animations, skeleton loaders, and empty states.
4.  **Tailwind Precision:** Absolute adherence to RTL logical properties and the dark mode color palette.
5.  **Global Compliance:** All monetisation must use the Dual Currency format, and all text must be piped through `| t` for instant localization.

```

```
