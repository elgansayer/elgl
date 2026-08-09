Here is the extremely detailed, exhaustive prompt tailored for your Angular architecture to paste into Claude Code Design.

```markdown
# EXHAUSTIVE SYSTEM ARCHITECTURE & UI/UX DESIGN SPECIFICATION: THE ULTIMATE LANGUAGE PLATFORM

## 1. Executive Summary & Foundational Constraints

### 1.1 Project Overview

You are tasked with generating the complete, production-ready frontend architecture and UI component library for a massive social language learning platform. This platform merges the social discovery and messaging of HelloTalk, the interactive tokenised reading and SRS flashcards of LingQ, and the structured, monetised tutor marketplace of italki.

### 1.2 Technology Stack & Strict Directives

- **Framework:** Angular (strictly using Standalone Components, Angular Signals for state management, and heavily typed RxJS observables).
- **Styling Engine:** Tailwind CSS. You must strictly use logical CSS properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`) to ensure perfect Right-To-Left (RTL) language support (e.g., Arabic, Hebrew).
- **Visual Aesthetic:** Premium "Dark Mode First". Deep obsidian backgrounds (`bg-gray-950`), slate containers (`bg-gray-900`), vibrant purple primary actions (`text-purple-500`), and neon mint secondary indicators.
- **Accessibility (WCAG AA):** Minimum 44px touch targets on mobile, full ARIA roles, and keyboard tab-index navigability.
- **Localisation (i18n):** Zero hardcoded strings. All text must pipe through `@ngx-translate` keys.
- **Monetisation Display:** You must always display monetary values in dual currencies simultaneously globally (e.g., 10 UKP / 12.50 USD).

---

## 2. Core Functional Modules & Component Architectures

### 2.1 Universal Onboarding & Profile Engine

- **Multi-Step Wizard:** Collect target language (e.g., Japanese), native language (e.g., English), CEFR level (A1 to C2), and study goals.
- **User Profile Screen:** Includes a cover image, avatar with real-time online presence (Centrifugo), native/target language flag badges, and learning statistics (active streak days, words mastered, correction ratio).
- **Profile Settings & Privacy:** Toggles for "Hide Age", "Hide Distance", and GDPR compliance tools (Export JSON, Delete Account).

### 2.2 Advanced Matchmaking & Discovery (PostGIS Driven)

- **Discovery Map & Feed:** Tabbed view between a scrolling list of recommended partners and a PostGIS-powered geographic map showing nearby learners.
- **Filter Drawer:** Sliders for age range, proximity radius, CEFR levels, and a "Serious Learner Only" algorithmic toggle.
- **Hashtag Subscriptions:** Users can subscribe to tags (e.g., #JLPT, #Slang, #Grammar) which algorithmically sorts their discovery and Moments feeds.

### 2.3 The "Moments" Social Feed

- **Post Composition:** Multi-modal builder allowing text, up to 9 grid images, or 60-second voice notes with waveform visualisations.
- **Feed Tabs:** "All", "Classmates" (matching language pairs), "Following", and "Topics" (hashtags).
- **Native Speaker Corrections (Visual Diff):** Inline comment UI where User A edits User B's text. Rendered as structured JSON diffs with red strikethroughs for original text and green highlights for fixes.
- **Inline Tools:** One-tap translate (Azure/DeepL), Text-to-Speech audio reader, and Transliteration (Romaji/Pinyin).

### 2.4 Chat & Direct Messaging (Centrifugo & LiveKit)

- **Layout:** Dual-pane for desktop (sidebar inbox, right canvas), standard stack navigation on mobile.
- **Message Types:** Text, async voice notes (with adjustable playback speed and AI transcription), images, live GPS location cards, and HTML5 Doodle canvases.
- **Real-time Features:** Typing indicators, granular read receipts, and online status.
- **Language Tools Context Menu:** Long-press on any message opens a modal to "Translate", "Pronounce", "Correct", or "Add to LingQ SRS".
- **VoIP Calling:** Native integration of LiveKit for 1-on-1 audio and high-definition video calls.

### 2.5 Live Audio Rooms ("Language Parties")

- **Lobby Discovery:** Filterable horizontally scrolling chips for room size, CEFR level, and topic.
- **Room Cards:** Large host avatar, overlapping speaker avatars, pulsating "LIVE" badge, and dual-currency entry fee if paid (e.g., 5 UKP / 6.50 USD).
- **Stage UI (LiveKit):** Active speaker glowing rings, audience grid below.
- **Host Moderation Tools:** Approve "Raise Hand" requests, mute/kick users, trigger soundboard audio.
- **Interactive Overlays:**
  - Synchronised Centrifugo text chat drawer.
  - Language Exchange Timer (e.g., 15 mins English, 15 mins Japanese).
  - Icebreaker Prompts carousel.
  - Real-time AI closed captions.
  - Tipping interface for sending virtual coins triggering full-screen SVG animations.

### 2.6 Classrooms & Tutor Marketplace (italki Integration)

- **Tutor Profiles:** "Professional Teachers" vs "Community Tutors". Includes introductory video players, verified credentials, and dynamic reviews.
- **Scheduling Calendar:** Timezone-aware booking matrix with logic for cancellation buffers and conflict resolution.
- **Escrow System Checkout:** Displays pricing transparently (e.g., 15 UKP / 19.00 USD). Funds are held until lesson completion.
- **Virtual Classroom Interface:** Split-screen video UI featuring a synchronised HTML5 whiteboard, screen sharing, and a collapsible syllabus/notes sidebar.

### 2.7 Interactive Reading Engine & SRS (LingQ Integration)

- **Tokenisation Engine:** Every text string in the app (Chats, Moments, Articles) passes through `Intl.Segmenter` to become an interactive span token.
- **SRS State Styling:** Tokens are coloured based on SRS level: Level 0 (Blue/Unknown), Levels 1-3 (Yellow/Learning), Level 4 (Transparent/Mastered).
- **Click-to-Define Popover:** Tapping a token yields dictionary definitions, IPA pronunciation, audio playback, and SRS level adjusters.
- **Audio Sync:** Long-form reading texts synchronise with audio tracks, highlighting the spoken sentence via timestamp matching.

### 2.8 Groups & Event Scheduling

- **Group Profiles:** Cover photo, rules, admin list, and tags. "Join Group" button routes user directly into a massive WhatsApp-style Centrifugo group chat.
- **Event RSVP System:** Discoverable webinars or IRL local meetups. Includes map snippets for physical locations, calendar export features, and dual-currency ticketing (e.g., 20 UKP / 25.00 USD).

### 2.9 Sharing Engine & Deep Linking

- **Universal Share Sheet:** Any entity (Moments, Groups, Classrooms, Profiles) can be shared internally to DMs or externally.
- **Rich Previews:** Shared links render natively in-app as rich interactive cards with actionable buttons ("RSVP", "Book Now", "Join Stage").
- **Dynamic Deep Links:** URLs that correctly route mobile users into the app or fallback to a web preview.

### 2.10 Gamification, Economy & VIP Subscriptions

- **Virtual Coin Wallet:** Users purchase bundles to buy gifts, tip hosts, or unlock specific grammar modules.
- **Streaks & Rewards:** Daily check-in modal granting coins, study streak flames, and weekly community leaderboards.
- **VIP Monetisation Tiers:**
  - Consumer Tier (8 UKP / 10.00 USD per month): Ad removal, unlimited AI translations, advanced search metrics.
  - Developer Tier (20 UKP / 26.00 USD per month): API keys and custom bot creation tools.

---

## 3. Implementation Output Expectations

When responding, you must provide:

1.  **Component Architecture:** The file structure and module boundaries.
2.  **TypeScript Logic:** Angular Signals implementations for state management across these complex interconnected modules.
3.  **HTML Templates:** Clean, semantic structure with proper ARIA labels.
4.  **Tailwind CSS:** Comprehensive styling using the specified dark mode palette and logical properties.
5.  **Strict Compliance:** Ensure all monetisation displays use the dual UKP / USD format and all English is strictly British English.
```
