# Application Design & Architecture (HelloTalk Clone)

## 1. System Overview
This document scopes out the high-level design, architecture, and technology stack for the HelloTalk clone application. The system is designed to handle real-time language exchange, VoIP, matchmaking, and interactive reading (LingQ clone), serving both mobile and desktop users.

## 2. Technology Stack
- **Frontend Framework:** Angular (latest stable) using Standalone components and Signals for reactive state management.
- **Styling:** Tailwind CSS (using logical properties `ps-`, `pe-`, `ms-`, `me-` for strict RTL support) and modern micro-animations.
- **Backend API:** NestJS (TypeScript) enforcing modular and scalable architecture.
- **Database & Auth:** Supabase (PostgreSQL). Employs PostGIS for spatial/proximity queries and `pg_trgm` for fuzzy search.
- **Real-Time Messaging:** Centrifugo paired with Redis for pub/sub messaging and fan-out feeds.
- **Real-Time Audio/Video:** LiveKit (WebRTC SFU architecture) for VoIP, drop-in voice rooms, and video broadcasting.
- **Media Hosting:** Cloudflare R2 (S3-compatible) for zero egress fees on images, voice notes, and video replays.
- **AI & NLP:** `NLP.js` on the backend for language detection, integrating with DeepL and Azure for translation and grammar correction.

## 3. Core Modules

### 3.1. Auth & Security Module
- Supabase JWT validation using a custom `SupabaseAuthGuard`.
- Two-factor authentication and token-based device transfers.
- LiveKit and Centrifugo token minting driven by user sessions and roles.

### 3.2. Real-Time Chat Engine (Centrifugo)
- **1-on-1 and Group Chats:** Private and group channels.
- **Payload Variety:** Supports text, asynchronous voice notes, visual doodles, AI-driven corrections, and virtual gifts.
- **Message Search:** Real-time search utilizing PostgreSQL `pg_trgm`.

### 3.3. AI & Immersion Engine
- **Visual Diffs:** Community corrections utilizing strict JSON payloads (`{ original, fixed, explanation }`).
- **In-line Translations & TTS:** Daily rate-limited (via Redis) translations and AI text-to-speech for free users; unlimited for VIPs.
- **Grammar & Pronunciation Check:** Pre-send API checks using Azure Speech/Translator.

### 3.4. Matchmaking & Discovery (PostGIS)
- Geospatial queries leveraging `ST_DWithin` to find nearby language partners.
- "Serious Learner" algorithm surfacing active users with high correction ratios.
- VIP location spoofing capabilities for privacy control.

### 3.5. LiveKit Audio & Video Broadcasting
- **24/7 Drop-In Rooms:** Public rooms where listeners can "Raise Hand" to receive publish grants (`canPublish: true`).
- **Live Streams & Co-hosting:** Professional host broadcasting with real-time AI subtitles.

### 3.6. Interactive Reading Engine (LingQ Clone)
- **Universal Word Tokenisation:** Leverages native `Intl.Segmenter` API to split text into interactable word spans.
- **Spaced Repetition System (SRS):** Vocabulary words are tagged from Blue (New) to Yellow (Learning) to White (Mastered).
- **Synchronised Audio:** `<audio>` `timeupdate` synchronizes with token spans to highlight spoken phrases.

### 3.7. Global Social Feed ("Moments")
- Multi-modal global timeline with community corrections and built-in translations.
- Asynchronous fan-out architecture routing moments to followers via Redis queues.

## 4. Frontend & UX Architecture
- **Clone-First Aesthetics:** A pixel-perfect, mobile-first design adhering to strict dark mode (`#121212`), vibrant neon accents, horizontal scrollable pills, and dense flag indicators.
- **Globalisation & RTL:** Zero hard-coded UI strings. Full multi-language support dynamically mapping to `TranslatePipe` and native RTL layouts using Tailwind logical properties.
- **No Legacy Decorators:** Components strictly avoid `@Input`, `@Output`, and RxJS observables for state derivation, relying instead on `input()`, `output()`, `computed()`, and `resource()`.

## 5. Monetisation Strategy
- **Consumer VIP (8 UKP / 10 USD):** Unlimited AI features, ad-removal, up to 3 target languages, and incognito mode.
- **Developer/Creator (20 UKP / 26 USD):** API keys, analytics, and custom bot configurations.
- **Virtual Economy:** Stripe/App Store webhooks handling virtual coin purchases for gifts and room tips.
