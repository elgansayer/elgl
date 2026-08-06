Here is the extremely detailed, exhaustive prompt tailored for your Angular architecture to paste into Claude Code Design. It maps every single screen, modal, primitive, interaction, and component implemented in the application, including offline states and architectural requirements.

```markdown
# EXHAUSTIVE SYSTEM ARCHITECTURE & UI/UX DESIGN SPECIFICATION: THE ULTIMATE LANGUAGE PLATFORM

## 1. Executive Summary & Foundational Constraints

### 1.1 Project Overview

You are tasked with generating the complete, production-ready frontend architecture and UI component library for a massive social language learning platform. This platform merges the social discovery and messaging of HelloTalk, the interactive tokenised reading and SRS flashcards of LingQ, and the structured, monetised tutor marketplace of italki.

### 1.2 Technology Stack & Strict Directives

- **Framework:** Angular (strictly using Standalone Components, Angular Signals for state management, and heavily typed RxJS observables/Resources).
- **Styling Engine:** Tailwind CSS. You must strictly use logical CSS properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`) to ensure perfect Right-To-Left (RTL) language support (e.g., Arabic, Hebrew).
- **Visual Aesthetic:** Premium "Dark Mode First". Deep obsidian backgrounds (`bg-gray-950`), slate containers (`bg-gray-900`), vibrant purple primary actions (`text-purple-500`), and neon mint secondary indicators.
- **Accessibility & UX:** Minimum 44px touch targets on mobile, full ARIA roles, skeleton loaders for all async data, empty states for all lists, and keyboard tab-index navigability.
- **Localisation (i18n):** Zero hardcoded strings. All text across all features (including Sticker Store, Discovery Map, Live Rooms, etc) must pipe through `@ngx-translate` keys or `I18nService.translate()`.
- **Monetisation Display:** You must always display monetary values in dual currencies simultaneously globally (e.g., 10 UKP / 12.50 USD).
- **Universal Tokenisation:** `Intl.Segmenter` API must be used to parse all text into clickable word tokens.
- **Resilience & Security:** The UI must support offline PWA fallbacks (IndexedDB caching), graceful degradation during bad network states, and enforce strict DOMPurify HTML sanitization on all user-generated content (chats, moments).

---

## 2. Design System & UI Primitives

All UI development must reuse the following established primitives before building custom designs:

- **Buttons:** `button-primary`, `button-secondary`, `gradient-button`
- **Inputs:** `input`, `textarea`, `language-picker`, `emoji-picker`, `sticker-picker`
- **Containers:** `card`, `empty-state` (must be used for all empty lists)
- **Interactive UI:** `chip`, `pill`, `scrollable-pills`, `user-onboarding-tooltips`
- **Visual Indicators:** `fluency-indicator`, `audio-equalizer`, `toast`, `skeleton-loaders` (for all pending async states)

---

## 3. Core Functional Modules & Screens

### 3.1 Authentication & Security (Account Lifecycle)

- **Onboarding Wizard (`onboarding`)**: Multi-step flow with tooltips for language pairs, CEFR levels, and goals.
- **Device Security**: `device-lock` (PIN entry), `device-transfer` (Secure account migration).
- **Password Management**: `forgot-password`, `reset-password`, `change-password`.
- **Data Lifecycle**: `account-deletion`, `gdpr` (Personal Data export and management flows).

### 3.2 Advanced Matchmaking & Discovery (PostGIS Driven)

- **Discovery Map & Feed (`discovery`)**: Geographic map showing nearby learners + scrolling list of recommendations (fully localized).
- **Filter Mechanics**: `age-range-slider`, `distance-slider`, and location privacy toggles.
- **Study Buddy (`study-buddy`)**: Intelligent matching for dedicated language partners.
- **Tags & Interests**: `hobby-tags`, `interests-select`, `topic-following`.

### 3.3 The "Moments" Social Feed & Content

- **Moments Feed (`moments`)**: Social timeline with media attachments, quick replies, and reactions. Content strictly sanitized via DOMPurify.
- **Content Creation**: `media-attachments`, `cover-photo-uploader`, `image-lightbox`.
- **Visual Diff Corrections (`visual-diff`, `correction-modal`)**: Inline JSON diffs with red strikethroughs and green highlights for native speaker corrections.
- **Interactive Elements**: `moment-translate`, `word-definition-modal`, `cultural-tip`.

### 3.4 Chat & Direct Messaging (Centrifugo & LiveKit)

- **Chat Management**: `chat-list`, `chat-room`, `chat-settings`, `chat-search`, `chat-backup`. Includes IndexedDB offline caching.
- **Rich Messaging**: Voice notes (`voice-recorder`), HTML5 canvas (`doodle-pad`), `chat-system-bubble`, `sticker-store`.
- **Context Menus (`message-context-menu`, `long-press-context-menu`)**: Translate, Pronounce, Correct, Add to LingQ SRS.
- **Audio/Video Calls**: `video-call`, `active-call`, `voip-call`, `incoming-call-modal`, `call-logs`.

### 3.5 Live Audio Rooms & Communities ("Language Parties")

- **Room Discovery (`audio-rooms`, `language-parties`)**: Real-time room lobbies with LiveKit integrations and optimized WebRTC latency.
- **Stage Dynamics (`audio-stage`, `split-screen-video`)**: Glowing rings for active speakers, audience grid, host moderation.
- **Interactive Overlays**: `live-chat-overlay`, `voiceroom-notes`, `celebration-overlay`, `gift-animation-overlay`, `soundboard`.
- **Groups & Events**: `groups-discovery`, `join-group`, `create-group`, `communities`, `events-feed`, `events-calendar`, `create-event-modal`.

### 3.6 Classrooms & Tutor Marketplace (italki Integration)

- **Lessons & Marketplace**: `lessons`, `classrooms-marketplace`, localized Tutor Profiles.
- **Diagnostic Tools**: `diagnostic-quiz`, `proficiency-assessment`.
- **Admin**: `lesson-manager`.

### 3.7 Interactive Reading Engine & SRS (LingQ Integration)

- **Interactive Tokenisation**: `tokenised-text` rendering interactive spans.
- **Language Hub**: `vocabulary-dashboard`, `vocabulary-display`, `suggest-flashcards`, `word-of-the-day`.
- **Pronunciation & Tools**: `pronunciation-feedback`, `audio-sync-reader`, `text-to-speech`.
- **Content Libs**: `resource-library`, `language-islands`, `ai-conversation`.

### 3.8 User Profiles, Gamification & Stats

- **Profile Rendering**: `profile`, `user-detail`, `business-profile`, `external-profile`, `profile-visitors`.
- **Social Graph**: `follow-list` (Followers/Following), `liked-by-modal`, `favourites`.
- **Gamification & Engagement**: `study-streak-counter`, `streak-celebration-overlay`, `daily-login-modal`, `earned-badges`, `leaderboard`, `milestone`, `quests`.
- **Statistics**: `my-stats`, `visitor-logs`.

### 3.9 Settings, Support & App Management

- **Settings Dashboard (`settings`)**: App-wide configuration, fully translated.
- **Customization**: `appearance-settings`, `theme-selector`, `font-scale-slider`.
- **Preferences**: `language-settings`, `notification-preferences`, `notification-customization`, `data-storage`, `blocks`.
- **Trust & Safety**: `moderation-queue`, `report-user-modal`, `trust-safety-modal` (all localized).
- **Legal & Help**: `help-centre`, `support-centre`, `help-about`, `terms`, `privacy`, `legal-document-viewer`.
- **Admin/Developer**: `admin-portal`, `developer-dashboard`, `version-check`, `forced-update-modal`.

### 3.10 Monetisation, Economy & VIP Subscriptions

- **Subscription Management**: `vip`, `subscription-plans`, `my-subscription`, `restore-purchases-button`.
- **Commerce / Shop**: `shop`, `cart`, `payment-gateway`.
- **Virtual Economy**: `coins-success`, `coins-cancel`, `virtual-gift-modal`, `gift-picker`, `host-dashboard`.
- **VIP Tiers**: Display pricing dynamically in dual currencies (e.g., 8 UKP / 10.00 USD).

---

## 4. Implementation Output Expectations

When responding, you must provide:

1.  **Component Architecture:** The file structure and module boundaries based on these exact features.
2.  **TypeScript Logic:** Angular Signals implementations for state management, resource APIs for fetching, and rigorous type-safety (NO type assertions/`as` casts). All APIs must handle rate-limiting errors and exponential backoff gracefully.
3.  **HTML Templates:** Clean, semantic structure with proper control flow (`@if`, `@for`), ARIA labels, interactive skeleton loaders, empty states, and Zero hardcoded strings (using `| t`).
4.  **Tailwind CSS:** Comprehensive styling using the specified dark mode palette and RTL-compliant logical properties.
5.  **Strict Compliance:** Ensure all monetisation displays use the dual UKP / USD format and all English is strictly British English.
```
