# HelloTalk Load Testing Suite

Artillery load-testing suite for HelloTalk, covering Trust & Safety, Spam Detection, Virtual Coin Economy, and Discovery/Matchmaking endpoints.

## Prerequisites

- Node.js 22+
- A running HelloTalk backend (default target: `http://localhost:3000`)
- A valid Supabase auth token for authenticated endpoint testing

## Quick Start

```bash
# Install dependencies
cd tests/load && npm install

# Run the Trust & Safety load test
TEST_USER_TOKEN=<your-jwt> npm run test:trust-safety

# Run the Spam Detection load test
TEST_USER_TOKEN=<your-jwt> npm run test:spam-detection

# Run the Escrow Payments load test
TEST_USER_TOKEN=<your-jwt> npm run test:escrow-payments

# Run the LingQ Reading Engine load test
TEST_USER_TOKEN=<your-jwt> npm run test:reading-engine

# Run the Moments load test
TEST_USER_TOKEN=<your-jwt> npm run test:moments

# Run the Discovery Map load test
TEST_USER_TOKEN=<your-jwt> npm run test:discovery-map

# Run the Matchmaking load test
TEST_USER_TOKEN=<your-jwt> npm run test:matchmaking

# Validate the Discovery load test configuration without a live backend
npm run test:discovery-validate
```

## Test Scripts

| Script | File | Description |
|--------|------|-------------|
| `test:trust-safety` | `trust-and-safety.load.yml` | Load tests all Safety, Moderation, and Blocks endpoints |
| `test:spam-detection` | `spam-detection.load.yml` | Load tests the SpamDetectionService `/spam-detection/check` endpoint |
| `test:economy` | `economy.load.yml` | Load tests the Virtual Coin Economy: gift catalog, coin packages, balance, daily check-in, checkout, purchase, gift sending, sticker packs |
| `test:matchmaking` | `matchmaking.load.yml` | Load tests the multi-tier Matchmaking Algorithm: personalised `/recommendations/for-you` feed, cached `/recommendations/daily`, dashboard mixed load, and rapid polling |
| `test:matchmaking:report` | (output + HTML) | Runs the Matchmaking test and generates an HTML report |
| `test:trust-safety:report` | (output + HTML) | Runs the Trust & Safety test and generates an HTML report |
| `test:srs-flashcards` | `srs-flashcards.load.yml` | SRS flashcard creation, review (SM-2), and retrieval load testing |
| `test:srs-flashcards:report` | (output + HTML) | Runs the SRS Flashcards test and generates an HTML report |
| `test:escrow-payments` | `escrow-payments.load.yml` | Load tests the Escrow Payments endpoints |
| `test:escrow-payments:report` | (output + HTML) | Runs the Escrow Payments test and generates an HTML report |
| `test:video-classrooms` | `video-classrooms.load.yml` | Load tests the Video Classrooms endpoints (LiveKit room creation and joining) |
| `test:video-classrooms:report` | (output + HTML) | Runs the Video Classrooms test and generates an HTML report |
| `test:discovery-map` | `discovery-map.load.yml` | Load tests all Discovery Map endpoints including partner search, language pair matching, location search, audio intros, partner of the week, recent native speakers, spotlight, and degradation-aware endpoints |
| `test:discovery-map:report` | (output + HTML) | Runs the Discovery Map test and generates an HTML report |
| `test:discovery-validate` | `validate-discovery-load-tests.js` | Static validation of the Discovery/Matchmaking load test configuration: YAML parse, `/api` prefix, helper hook wiring, SLO thresholds, and filter values |
| `test:reading-engine` | `reading-engine.load.yml` | Load tests the LingQ Reading Engine: resource CRUD, tokenisation, reading progress, and cache admin |
| `test:reading-engine:report` | (output + HTML) | Runs the Reading Engine test and generates an HTML report |
| `test:moments` | `moments.load.yml` | Load tests the Moments social feed: feed browsing, moment and story creation, language questions, likes, comments, correction voting, media upload URLs, editing, and pinning |
| `test:moments:report` | (output + HTML) | Runs the Moments test and generates an HTML report |

## Configuration

### Target URL

The scripts default to a locally running backend at `http://localhost:3000`. The NestJS API applies a global `/api` prefix, so every scenario path in this suite is written as `/api/...` (for example `/api/discovery/partners`).

Override the target with the `-t` flag:

```bash
npx artillery run -t https://staging.hellotalk.example.com discovery-map.load.yml
```

### Auth Token

Every Discovery and Matchmaking endpoint is behind `SupabaseAuthGuard`, so a valid Supabase JWT is required. Set it via the `TEST_USER_TOKEN` environment variable. There is no fallback token baked into the scripts:

```bash
TEST_USER_TOKEN="eyJhbGciOi..." npx artillery run discovery-map.load.yml
```

### Load Profiles

The Discovery and Matchmaking scripts include the following phases:

1. **Warmup** (30s) - Gradual 1 VU/s introduction
2. **Ramp** (60s) - Linear increase from 5 to 20 VUs/s
3. **Sustained** (120s) - Constant 20 VUs/s
4. **Spike** (30s) - Burst at 50 VUs/s

### Service Level Objectives

Both Discovery scripts assert SLO latency budgets with the `ensure` plugin. A run that exceeds any threshold exits non-zero so it can gate a release:

- `http.response_time.p99 < 2000` ms
- `http.response_time.p95 < 1000` ms
- `http.response_time.p50 < 500` ms

Every request also carries an `X-Load-Test-Id` header (via the `beforeRequest` hook in the helper processor) so load-test traffic can be correlated with server logs.

### Static Validation

`npm run test:discovery-validate` parses both Discovery YAML files and verifies the `/api` prefix, helper hook wiring, SLO thresholds, and filter values without needing a running backend.

## Endpoints Covered

### Safety Module (`/safety`)
- `GET /safety/report-categories` - Report category lookup
- `POST /safety/report` - User reporting
- `POST /safety/block/:id` - Block a user
- `POST /safety/unblock/:id` - Unblock a user
- `GET /safety/is-blocked/:id` - Check block status
- `GET /safety/blocked-ids` - Get current user's blocked IDs
- `GET /safety/blocked-ids/:userId` - Get blocked IDs for a user
- `GET /safety/blocker-ids/:userId` - Get blocker IDs for a user
- `GET /safety/blocked-and-blocker-ids/:userId` - Combined blocked+blocker list
- `GET /safety/blocked-users-details` - Detailed blocked user profiles

### Moderation Module (`/moderation`)
- `GET /moderation/items` - Moderation queue retrieval
- `POST /moderation/report` - User report submission
- `GET /moderation/analyse/:userId` - Dating behaviour analysis

### Blocks Module (`/blocks`)
- `GET /blocks` - Get blocked users list

### Spam Detection (`/spam-detection`)
- `POST /spam-detection/check` - Content spam check

### SRS Flashcards (`/flashcards`)
- `POST /flashcards` - Create or update a flashcard
- `PATCH /flashcards/:id/srs` - Review a flashcard with SM-2 spaced repetition scoring
- `GET /flashcards` - List all flashcards for the authenticated user
- `GET /flashcards?level=<n>` - List flashcards filtered by SRS level (0-4)
- `GET /flashcards/due` - Get flashcards currently due for review

### Escrow Payments (`/escrow`)
- `GET /escrow/transactions` - List paginated user escrow transactions with status/sort filters
- `POST /escrow/transactions` - Create a new escrow transaction with milestones
- `GET /escrow/transactions/:id` - Get details for a single escrow transaction
- `GET /escrow/transactions/:id/status` - Check escrow transaction status
- `POST /escrow/transactions/:id/release` - Release escrow milestone payment
- `POST /escrow/transactions/:id/refund` - Refund escrow transaction to payer
- `POST /escrow/transactions/:id/dispute` - File a dispute for an escrow transaction
- `POST /escrow/transactions/:id/cancel` - Cancel a pending escrow transaction
- `GET /escrow/summary` - Get escrow summary statistics

### Discovery Map Module (`/discovery`)
- `GET /api/discovery/partners` - Personalised partner search with filters (language, location, level, age, gender, interests, availability, serious learner mode, voice room, audio intro)
- `GET /api/discovery/partner-of-week` - Weekly Partner of the Week cached list
- `GET /api/discovery/audio-intros` - Audio intro discovery with language filters
- `GET /api/discovery/recent-native-speakers` - Recently joined native speakers
- `GET /api/discovery/spotlight` - Spotlight user profiles
- `GET /api/discovery/language-pair` - Language pair matching with pagination and sorting
- `GET /api/discovery/search-by-location` - Location-based user search by country and city
- `GET /api/discovery/degradation-status` - Current circuit breaker states and recent degradation events
- `GET /api/discovery/partners-with-degradation` - Partner search returning a degradation marker alongside results

### Matchmaking Module (`/recommendations`)
- `GET /api/recommendations/for-you` - Multi-tier personalised "for you" recommendations (interest, language exchange, active users, mock)
- `GET /api/recommendations/daily` - Daily cached language exchange recommendations

### Economy Module (`/economy`)
- `GET /economy/catalog` - Virtual gift catalog
- `GET /economy/packages` - Coin package definitions
- `GET /economy/balance` - User coin balance
- `POST /economy/daily-check-in` - Daily check-in claim
- `POST /economy/create-checkout-session` - Stripe checkout session creation
- `POST /economy/purchase-coins` - Coin purchase via receipt verification
- `POST /economy/send-gift` - Send virtual gift to another user
- `GET /economy/sticker-packs` - Sticker pack storefront
- `POST /economy/unlock-sticker-pack` - Unlock a sticker pack

### Video Classrooms Module (`/video-calls`)
- `POST /video-calls/start` - Create a new LiveKit video room and return an access token
- `POST /video-calls/accept` - Join an existing LiveKit video room with a room name

### LingQ Reading Engine (`/reading`)
- `POST /reading/resources` - Create a new reading resource
- `GET /reading/resources` - List reading resources with filters (language, difficulty, topic)
- `GET /reading/resources/:id` - Get a single reading resource
- `PUT /reading/resources/:id` - Update a reading resource
- `DELETE /reading/resources/:id` - Delete a reading resource
- `GET /reading/resources/:id/tokenise` - Tokenise a resource using Intl.Segmenter
- `GET /reading/progress` - Get authenticated user's reading progress
- `POST /reading/progress/session` - Record a completed reading session
- `DELETE /reading/cache/user` - Clear reading-engine caches for authenticated user

### Moments Module (`/moments`)
- `GET /moments/feed` - Browse the Moments feed with `All`, `Classmates`, `Following`, and `For You` filters and optional language
- `GET /moments/lifetime-counts` - Lifetime translation, correction, and moment counts
- `GET /moments/stories` - List active ephemeral stories for followed users
- `POST /moments` - Create a text or media Moment
- `POST /moments/stories` - Create an ephemeral story (default 24 hour expiry)
- `POST /moments/language-questions` - Create a multiple-choice language question
- `GET /moments/questions` - List questions and language questions, optionally filtered by language
- `POST /moments/:id/answer` - Answer a language question
- `POST /moments/:id/like` - Like or unlike a Moment (toggles)
- `GET /moments/:id/likes` - List users who liked a Moment
- `POST /moments/:id/comments` - Add a comment or correction to a Moment
- `GET /moments/:id/comments` - List comments for a Moment
- `POST /moments/:id/comments/:commentId/vote` - Up-vote or down-vote a correction
- `PATCH /moments/:id/edit-text` - Edit the text of a Moment
- `PATCH /moments/:id/pin` - Toggle pinning a Moment (VIP only, expects 200 or 403)
- `POST /moments/upload-voice` - Request a Cloudflare R2 voice upload URL (VIP only, expects 201 or 403)
- `POST /moments/upload-media` - Request a Cloudflare R2 image/video upload URL
