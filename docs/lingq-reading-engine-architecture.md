# LingQ Reading Engine: Technical Architecture & OpenAPI Specification

**Version:** 1.0
**Last Updated:** 2026-08-07
**Base URL:** `https://api.hellotalk.example.com/api`

---

## 1. Overview

The LingQ Reading Engine is the interactive reading and vocabulary acquisition system within the HelloTalk Clone platform. It enables learners to read curated articles and dialogues, click individual word tokens for instant translation and definition, and build a personalised Spaced Repetition System (SRS) vocabulary library.

### 1.1 Core Capabilities

| Capability | Description |
|---|---|
| **Universal Word Tokenisation** | Every text is parsed using native `Intl.Segmenter(locale, { granularity: 'word' })` to transform plain text into individually clickable word tokens. |
| **Click-to-Translate & Define** | Clicking any word token opens an instant pop-up showing dictionaries, audio pronunciation, and example sentences. |
| **Spaced Repetition System (SM-2)** | Full implementation of the SuperMemo SM-2 algorithm for vocabulary scheduling across five SRS levels (0-4). |
| **Curated Reading Content** | Publish, query, and read articles and dialogues levelled by CEFR (A1-C2) with optional audio narration. |
| **Deck Organisation** | Organise flashcards into custom-named, colour-coded decks for thematic study groups. |
| **Vocabulary Suggestion Engine** | NLP-powered word suggestion that tokenises messages via `Intl.Segmenter`, deduplicates, and excludes already-known vocabulary (SRS level 4). |
| **Live Vocabulary Highlighting** | Word tokens are dynamically styled with CSS colours reflecting the user's personal vocabulary state (Blue/Yellow/White). |
| **Audio-Synchronised Reading** | `<audio>` `timeupdate` events synchronise with `Intl.Segmenter` spans to highlight the currently spoken phrase in real time. |
| **Defence-in-Depth Rate Limiting** | Global `ThrottlerGuard` + Redis-backed `SrsRateLimiterGuard` per-endpoint, per-user sliding-window rate limiting. |
| **Metrics & Observability** | Prometheus gauges via `SrsMetricsAggregator` cron, producing deck counts, due cards, per-level distribution, average easiness factor, and stuck-card detection. |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────┐
│                 Angular Frontend                 │
│  TokenisedTextComponent   FlashcardReviewComponent│
│  FlashcardDeckComponent   SrsErrorBoundary        │
│  SuggestFlashcardsComponent                       │
└──────────────┬───────────────────────────────────┘
               │ HTTP REST (Bearer JWT)
               ▼
┌──────────────────────────────────────────────────┐
│              NestJS Backend API                   │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  CuratedContentController (/curated-content) ││
│  │  - GET /articles, GET /articles/:id          ││
│  │  - POST /articles (auth)                     ││
│  │  - GET /dialogues, GET /dialogues/:id         ││
│  │  - POST /dialogues (auth)                     ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  FlashcardsController (/flashcards)          ││
│  │  - POST / (create/upsert flashcard)          ││
│  │  - PATCH /:id/srs (submit SM-2 review)        ││
│  │  - GET / (list, filter by srs_level)         ││
│  │  - GET /due (cards due for review)           ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  SuggestFlashcardsController                 ││
│  │  (/flashcards/suggest)                       ││
│  │  - GET / (suggest from message via NLP)       ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  DecksController (/decks)                     ││
│  │  - POST / (create deck)                       ││
│  │  - GET / (list decks)                         ││
│  │  - GET /:id (get single deck)                 ││
│  │  - PATCH /:id (update deck)                   ││
│  │  - DELETE /:id (delete deck)                   ││
│  │  - POST /:id/flashcards (add card to deck)    ││
│  │  - DELETE /:id/flashcards/:flashcardId        ││
│  │  - GET /:id/flashcards (list cards in deck)   ││
│  └──────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────┐│
│  │  SrsRateLimiterGuard (Redis sliding window)   ││
│  │  SrsMetricsAggregator (Prometheus cron @1m)  ││
│  └──────────────────────────────────────────────┘│
└──────────────┬───────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌──────────┐
│Supabase│ │ Redis │ │Prometheus│
│ (PG)  │ │(Cache)│ │ (Metrics)│
└───────┘ └───────┘ └──────────┘
```

---

## 3. Data Model

### 3.1 Flashcards Table (`flashcards`)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Primary key |
| `user_id` | `uuid` (FK -> auth.users) | Owner of the flashcard |
| `word_token` | `text` | The word token to learn (lowercase, trimmed) |
| `original_context` | `text?` | Original sentence context where the word appeared |
| `translation` | `text` | Translation into the user's native language |
| `definition` | `text?` | Dictionary definition |
| `pronunciation_url` | `text?` | Cloudflare R2 URL for audio pronunciation |
| `srs_level` | `int` (0-4) | SM-2 derived SRS level (0=New/Blue, 1-3=Learning/Yellow, 4=Known/White) |
| `easiness_factor` | `float` (>= 1.3) | SM-2 easiness factor |
| `repetitions` | `int` | Number of successful recall repetitions |
| `interval_days` | `int` | Days until next review |
| `next_review_at` | `timestamptz` | Scheduled next review timestamp |
| `created_at` | `timestamptz` | Creation timestamp |

**Unique constraint:** `(user_id, word_token)` -- upsert on conflict.

### 3.2 Decks Table (`decks`)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Primary key |
| `user_id` | `uuid` (FK -> auth.users) | Owner of the deck |
| `name` | `text` | Deck display name |
| `description` | `text?` | Optional deck description |
| `colour` | `text` | Hex colour code (default: `#6366f1`) |
| `icon` | `text` | Icon identifier (default: `📚`) |
| `card_count` | `int` | Denormalised flashcard count |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### 3.3 Deck-Flashcards Junction (`deck_flashcards`)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Primary key |
| `deck_id` | `uuid` (FK -> decks.id) | Deck reference |
| `flashcard_id` | `uuid` (FK -> flashcards.id) | Flashcard reference |
| `added_at` | `timestamptz` | Association timestamp |

**Unique constraint:** `(deck_id, flashcard_id)` -- prevents duplicates.

### 3.4 Curated Articles (`curated_articles`)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Primary key |
| `title` | `text` | Article title |
| `cefr_level` | `text` | CEFR level (A1-C2) |
| `language` | `text` | ISO 639-1 language code |
| `source_url` | `text?` | Original source URL |
| `content_text` | `text` | Full article text |
| `word_count` | `int?` | Total word count |
| `difficulty_rating` | `int?` | Difficulty 1-10 |
| `audio_url` | `text?` | R2 URL for audio narration |
| `image_url` | `text?` | R2 URL for cover image |
| `tags` | `text[]?` | Topic tags array |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### 3.5 Curated Dialogues (`curated_dialogues`)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Primary key |
| `title` | `text` | Dialogue title |
| `cefr_level` | `text` | CEFR level (A1-C2) |
| `language` | `text` | ISO 639-1 language code |
| `source_url` | `text?` | Original source URL |
| `lines` | `jsonb[]` | Array of speaker lines: `{speaker, text, translation?, audioUrl?}` |
| `audio_url` | `text?` | R2 URL for full dialogue audio |
| `image_url` | `text?` | R2 URL for cover image |
| `tags` | `text[]?` | Topic tags array |
| `created_at` | `timestamptz` | Creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

---

## 4. SM-2 Algorithm Implementation

The SM-2 (SuperMemo 2) algorithm is implemented in `FlashcardsService.applySm2Algorithm()`.

### 4.1 Algorithm Parameters

| Parameter | Symbol | Initial Value | Description |
|---|---|---|---|
| Easiness Factor | `EF` | 2.5 | Reflects item difficulty; minimum 1.3 |
| Repetitions | `n` | 0 | Number of successful recalls |
| Interval (days) | `I` | - | Days until next review |
| Quality | `q` | 0-5 | User's self-assessed recall quality |

### 4.2 Quality Scale

| Value | Description |
|---|---|
| 0 | Complete blackout |
| 1 | Incorrect, but correct answer remembered upon seeing |
| 2 | Incorrect, but correct answer seemed easy to recall |
| 3 | Correct with serious difficulty |
| 4 | Correct after hesitation |
| 5 | Perfect response |

### 4.3 Algorithm Steps

```
1. If q < 3 (failed recall):
   - Reset repetitions to 0
   - Set interval to 1 day
2. If q >= 3 (successful recall):
   - n=0 -> I=1
   - n=1 -> I=6
   - n>=2 -> I = round(I * EF)
   - repetitions = n + 1
3. Update easiness factor:
   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
   EF' = max(1.3, EF')
4. Derive SRS level:
   - n=0 -> level 0 (Blue/New)
   - n=1 -> level 1 (Yellow/Learning)
   - n=2 -> level 2 (Yellow/Learning)
   - I < 21 -> level 3 (Yellow/Learning)
   - I >= 21 -> level 4 (White/Known)
```

---

## 5. Rate Limiting Strategy

### 5.1 Global Throttler (ThrottlerGuard)

Applied to all endpoints via `APP_GUARD` with default limits of 10 requests per 60 seconds.

### 5.2 SRS-Specific Rate Limiting (SrsRateLimiterGuard)

Per-endpoint, per-user Redis sliding-window rate limiting with defence-in-depth:

| Endpoint | Max Requests | Window |
|---|---|---|
| `POST /flashcards` | 30 | 60s |
| `PATCH /flashcards/:id/srs` | 120 | 60s |
| `GET /flashcards` | 30 | 60s |
| `GET /flashcards/due` | 60 | 60s |
| `GET /flashcards/suggest` | 20 | 60s |

**Key format:** `srs:ratelimit:{userId}:{controller}:{handler}`
**Behaviour:** Increments counter on each request. Sets TTL on first request of window. Returns HTTP 429 with `retryAfter` when exceeded. Fails open (allows through) if Redis is unavailable.

---

## 6. Caching Strategy

### 6.1 Cache-Control Directives

| Directive | Pattern | Use Case |
|---|---|---|
| `CACHE_PUBLIC_LONG` | `public, max-age=3600, s-maxage=86400` | Public read endpoints (article/dialogue lists) |
| `CACHE_PUBLIC_SHORT` | `public, max-age=300, s-maxage=1800` | Individual article/dialogue reads |
| `CACHE_PRIVATE_SHORT` | `private, max-age=300` | User-specific NLP suggestions |
| `CACHE_PRIVATE_MEDIUM` | `private, max-age=60, s-maxage=300` | Flashcard/deck listing |
| `CACHE_PRIVATE_NO_STORE` | `private, no-store, no-cache` | Mutation endpoints, SRS reviews |

All cached responses include Cloudflare's `CDN-Cache-Control` header for edge caching. On error, caching headers are overridden to `private, no-store` to prevent storing broken responses.

---

## 7. Frontend Component Architecture

### 7.1 TokenisedTextComponent

```typescript
// Inputs
text: InputSignal<string>          // Raw text to tokenise
language: InputSignal<string>      // ISO 639-1 locale for Intl.Segmenter

// Outputs
wordClicked: OutputEmitter<{       // Fires on word token click
  token: string
  context: string
}>
```

Internally uses `Intl.Segmenter(language, { granularity: 'word' })` to parse text into clickable tokens. Integrates with `VocabularyStore` for live colour highlighting based on SRS level and `TransliterationService` for script conversion.

### 7.2 FlashcardReviewComponent

Displays flashcards due for review with SM-2 quality scoring UI (0-5 rating). Communicates with `FlashcardService` for SRS updates.

### 7.3 FlashcardDeckComponent

Organises flashcards into colour-coded decks. Provides CRUD operations for deck management and drag-and-drop card assignment.

### 7.4 SuggestFlashcardsComponent

Takes user message input, calls `GET /flashcards/suggest` for NLP-suggested vocabulary, and displays suggestions as tappable chips for quick flashcard creation.

### 7.5 SrsErrorBoundary

Angular error boundary component that catches rendering errors within the SRS subtree. Displays user-friendly fallback UI and logs errors to the analytics endpoint without crashing the full application.

---

## 8. Metrics & Observability

### 8.1 SRS Metrics Aggregator

`SrsMetricsAggregator.collectSrsStats()` runs every 60 seconds via `@nestjs/schedule`:

| Metric | Gauge | Description |
|---|---|---|
| `srs_decks_total` | Total deck count | Number of decks in the system |
| `srs_due_cards` | Cards due for review | Flashcard count with `srs_level < 4` and `next_review_at <= now()` |
| `srs_cards_per_level` | Cards by SRS level | Breakdown per level (0-4) |
| `srs_average_easiness_factor` | Average EF | Mean easiness factor across all flashcards |
| `srs_cards_stuck` | Stuck cards | Cards at level 0 with 5+ repetitions (repeated recall failure) |

Metrics are pushed to Prometheus and can be visualised in Grafana or Datadog dashboards.

---

## 9. OpenAPI Tag Hierarchy

| Tag | Controller | Description |
|---|---|---|
| `Spaced Repetition (SRS)` | `FlashcardsController` | Flashcard CRUD, SRS review, and due review retrieval |
| `Spaced Repetition (SRS) / Suggest` | `SuggestFlashcardsController` | NLP-based vocabulary suggestion from message text |
| `Spaced Repetition (SRS) / Decks` | `DecksController` | Deck CRUD and flashcard-to-deck associations |
| `LingQ Reading Engine / Curated Content` | `CuratedContentController` | Reading articles and dialogues with CEFR levelling |

All SRS and deck endpoints require Bearer JWT authentication via `SupabaseAuthGuard`. Curated content read endpoints are public; write endpoints require authentication.

---

## 10. Security Considerations

| Concern | Mitigation |
|---|---|
| **SRS review spam** | Dual-layer rate limiting: global ThrottlerGuard + Redis-backed SrsRateLimiterGuard |
| **Unauthenticated flashcard access** | All endpoints guarded by `SupabaseAuthGuard`; user ID derived from verified JWT |
| **Cross-user flashcard manipulation** | All queries filter by `user_id` from JWT; `deck_flashcards` operations verify deck ownership first |
| **Curated content injection** | `SanitiseHtmlPipe` on all request bodies; `class-validator` whitelist mode in `ValidationPipe` |
| **Redis unavailability** | SRS rate limiter fails open (allows requests); Prometheus scraping continues independently |
| **SQL injection** | Supabase parameterised queries with `pg_trgm`-safe input sanitisation |

---

## 11. Integration Points

| System | Integration Type | Purpose |
|---|---|---|
| **Supabase** | Database + Auth | User authentication (JWT), `flashcards`, `decks`, `deck_flashcards`, `curated_articles`, `curated_dialogues` tables |
| **Redis** | Cache + Rate Limiting | Sliding-window counters for SRS endpoint rate limiting |
| **Cloudflare R2** | Object Storage | Audio pronunciations, article/dialogue audio narration, cover images |
| **NLP.js** | Language Detection | Target language detection for `Intl.Segmenter` locale selection |
| **DeepL API** | Translation | Click-to-translate vocabulary definitions (via NLP module) |
| **Centrifugo** | Real-Time Messaging | Vocabulary-related events broadcast (optional) |
| **Prometheus** | Metrics | SRS health gauges scraped every 60s |
| **Cloudflare CDN** | Edge Caching | `CDN-Cache-Control` headers for public article/dialogue reads |

---

## 12. API Quick Reference

### 12.1 Flashcards

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/flashcards` | Bearer | Create or upsert a flashcard |
| `PATCH` | `/api/flashcards/:id/srs` | Bearer | Submit SM-2 review (quality 0-5) |
| `GET` | `/api/flashcards` | Bearer | List user's flashcards (filter by `?level=`) |
| `GET` | `/api/flashcards/due` | Bearer | Get flashcards due for review |

### 12.2 Suggest

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/flashcards/suggest?message=...` | Bearer | Suggest vocabulary from message text |

### 12.3 Decks

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/decks` | Bearer | Create a deck |
| `GET` | `/api/decks` | Bearer | List user's decks |
| `GET` | `/api/decks/:id` | Bearer | Get single deck |
| `PATCH` | `/api/decks/:id` | Bearer | Update deck metadata |
| `DELETE` | `/api/decks/:id` | Bearer | Delete deck |
| `POST` | `/api/decks/:id/flashcards` | Bearer | Add flashcard to deck |
| `DELETE` | `/api/decks/:id/flashcards/:flashcardId` | Bearer | Remove flashcard from deck |
| `GET` | `/api/decks/:id/flashcards` | Bearer | List flashcards in deck |

### 12.4 Curated Content

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/curated-content/articles` | None | List articles (`?language=` & `?cefr_level=`) |
| `GET` | `/api/curated-content/articles/:id` | None | Get single article |
| `POST` | `/api/curated-content/articles` | Bearer | Create article |
| `GET` | `/api/curated-content/dialogues` | None | List dialogues (`?language=` & `?cefr_level=`) |
| `GET` | `/api/curated-content/dialogues/:id` | None | Get single dialogue |
| `POST` | `/api/curated-content/dialogues` | Bearer | Create dialogue |

---

## 13. Swagger UI Access

The full interactive OpenAPI 3.0 documentation is served at:

```
GET /api/docs
```

This includes all schema models, request/response examples, authentication requirements, and per-endpoint rate limiting documentation.