# HelloTalk Clone

A pixel-perfect, full-featured clone of HelloTalk - an AI-powered language exchange social network. Built autonomously by an AI Swarm using Angular, NestJS, Supabase, Centrifugo, and LiveKit.

---

## Features at a Glance

### Communication
- **Real-time chat** - 1-on-1 and group messaging via Centrifugo, with typing indicators and read receipts
- **Voice notes** - Hold-to-record async audio, uploaded to Cloudflare R2
- **VoIP audio calls** - LiveKit-powered 1-on-1 calls with call logs
- **HD video calls** - Face-to-face language sessions via LiveKit
- **Doodle tool** - HTML5 canvas drawing, send sketches to explain concepts
- **Virtual gifts** - Coin-purchased animated stickers with full-screen animations
- **Drop-in audio rooms** - 24/7 public voice rooms with Host/Speaker/Listener roles and raise-hand approval
- **Live video streams** - Co-hosted broadcasts with real-time AI subtitles and replay recording

### AI & Learning
- **In-line translation** - Tap any message to translate (DeepL, 260+ languages, rate-limited free / unlimited VIP)
- **Grammar checker** - Pre-send AI grammar check (Azure Translator)
- **Pronunciation scoring** - Record yourself, get graded 0-100 with phoneme heatmap (Azure Speech)
- **Native speaker corrections** - Visual diff tool showing original (red strikethrough) vs corrected (green)
- **Text-to-speech** - Azure TTS playback for any message or article
- **Voice-to-text** - Transcription of voice notes (Azure Speech)
- **AI conversation partner** - LLM-powered language tutor with automatic correction diffs
- **Interactive reading** - Universal word tokenisation (`Intl.Segmenter`), click any word to define/save
- **Audio-synchronised reading** - Text highlights in real time as audio plays
- **SRS flashcards** - Spaced repetition vocabulary deck (Blue/Yellow/White levels)

### Social & Discovery
- **Moments feed** - Instagram-style public timeline with text, images, and audio posts
- **Community corrections** - Embedded correction diffs in Moment comments
- **Partner discovery** - Goal-based matchmaking with PostGIS proximity search, online status, and algorithmic filters
- **Audio intro feed** - Browse users by voice introduction
- **Study buddy matching** - Dedicated compatibility pairing for long-term exchange partners
- **Events** - Community learning events with RSVP and calendar view
- **Language parties** - Themed group voice/video events
- **Groups & communities** - Topic-based group chats and discussion communities
- **Leaderboard** - Weekly/all-time XP rankings

### Gamification
- **Study streaks** - Daily streak tracking with freeze (VIP)
- **XP system** - Earn XP for every learning activity
- **Achievements** - Badge system with 40+ achievement types
- **Daily quests** - Gamified task list resetting each day
- **Milestones** - Progressive learning milestone timeline
- **Corrector score** - Reputation metric for giving quality corrections
- **Daily login reward** - Coin reward calendar

### Monetisation
- **VIP Consumer** - 8 UKP / $10 USD/month (ad-free, unlimited AI, 3 languages, incognito, streak freeze)
- **VIP Annual** - 6 UKP / $8 USD/month billed annually
- **Developer/Creator** - 20 UKP / $26 USD/month (API keys, analytics, bot builder)
- **Virtual coins** - Purchasable via Stripe / Apple IAP / Google Play, spent on gifts and tips
- Webhook-verified receipts, duplicate-transaction protection

### Safety & Privacy
- Block & report users
- Moderation queue (admin)
- Spam detection
- Visitor log gating (blurred for free, visible for VIP)
- Incognito mode (VIP - browse profiles without logging visits)
- GDPR data download + erasure
- Account deletion with 30-day cool-off

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Angular v22+ (signals, standalone, OnPush) |
| Styling | Tailwind CSS (logical properties, dark mode) |
| Backend | NestJS (TypeScript) |
| Database | Supabase (PostgreSQL + PostGIS + pg_trgm) |
| Auth | Supabase Auth (JWT, 2FA, device transfer) |
| Real-Time | Centrifugo + Redis |
| Audio/Video | LiveKit (WebRTC SFU) |
| Media | Cloudflare R2 |
| Translation | DeepL API |
| Speech & Grammar | Azure Cognitive Services |
| Payments | Stripe + Apple IAP + Google Play |
| Push | Firebase Cloud Messaging |
| AI Chat | LLM Proxy (OpenAI/Anthropic) |

---

## Design Language

The application follows a strict **dark-first mobile design**:
- Background: `#121212` base, surface cards `#1A1A1A`
- Primary accent: purple `#9333EA`
- Secondary accent: cyan `#06B6D4`
- VIP gold: `#F59E0B`
- Gradient buttons, horizontal scrollable pill filters, flag indicators, dense card layouts
- Full RTL support via Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `border-s`, `border-e`)
- Zero hard-coded strings - all text through `TranslatePipe`

See [`design.md`](./design.md) for the complete design specification including all tokens, every component API, every screen layout, and build instructions.

---

## Project Structure

```
hellotalk/
├── frontend/          # Angular v22+ application
│   └── src/app/
│       ├── components/        # Feature + primitive components
│       │   └── primitives/    # app-button-primary, app-card, app-chip, etc.
│       ├── pages/             # Route-level page components
│       ├── services/          # Angular services + state stores
│       ├── guards/            # Route guards
│       ├── i18n/              # Translation keys
│       └── app.routes.ts      # 60+ lazy-loaded routes
│
├── backend/           # NestJS API
│   └── src/
│       ├── auth/              # JWT guard, 2FA, device transfer
│       ├── chat/              # Messaging, Centrifugo tokens
│       ├── audio-rooms/       # LiveKit room management
│       ├── moments/           # Social feed
│       ├── discovery/         # PostGIS partner matching
│       ├── nlp/               # DeepL + Azure integration
│       ├── monetisation/      # Stripe + IAP webhooks
│       ├── economy/           # Coin balance + spending
│       └── ... (50+ modules)
│
├── supabase/          # SQL migrations
├── docker-compose.dev.yml
└── design.md          # Complete design & architecture spec
```

---

## Getting Started

### Prerequisites
- Node.js 22+, npm 10+
- Docker & Docker Compose

### Setup

```bash
# 1. Copy environment config
cp .env.example backend/.env
# Fill in all required values (see backend/src/config/validation.schema.ts)

# 2. Start infrastructure (Supabase, Redis, Centrifugo)
docker-compose -f docker-compose.dev.yml up -d

# 3. Start backend
cd backend && npm install && npm run start:dev

# 4. Start frontend
cd frontend && npm install && npm run start
```

App runs at `http://localhost:4200`, API at `http://localhost:3000`.

### Running Tests

```bash
# Frontend (Vitest)
cd frontend && npm test -- --watch=false

# Backend (Jest)
cd backend && npm test
```

### Build

```bash
cd frontend && npm run build
cd backend && npm run build
```

---

## AI Tooling

- **Dependabot:** Configured at `.github/dependabot.yml` - weekly automated dependency update PRs
- **CodeQL:** Enable via GitHub Settings > Code Security > CodeQL Analysis for automatic vulnerability scanning
- **Ngrok:** Available for local webhook testing: `npx ngrok http 3000`

---

## Documentation

- [`design.md`](./design.md) - Full design specification: tokens, every component, every screen, database schema, backend modules, and build guide
- [`FEATURES_SPEC.md`](./FEATURES_SPEC.md) - Detailed feature specification
- [`AGENTS.md`](./AGENTS.md) - Engineering constitution and coding standards for AI agents

