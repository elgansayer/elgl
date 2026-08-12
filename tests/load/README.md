# HelloTalk Load Testing Suite

Artillery load-testing suite for HelloTalk, covering Trust & Safety, Spam Detection, and Virtual Coin Economy endpoints.

## Prerequisites

- Node.js 22+
- A running HelloTalk backend (default target: `http://localhost:3000`)
- A valid Supabase auth token for authenticated endpoint testing

## Quick Start

```bash
# Install dependencies
cd tests/load && npm install

# Run the Trust & Safety load test
API_URL=http://localhost:3000 TEST_USER_TOKEN=<your-jwt> npm run test:trust-safety

# Run the Spam Detection load test
API_URL=http://localhost:3000 TEST_USER_TOKEN=<your-jwt> npm run test:spam-detection

# Run the Escrow Payments load test
API_URL=http://localhost:3000 TEST_USER_TOKEN=<your-jwt> npm run test:escrow-payments

# Run the LingQ Reading Engine load test
API_URL=http://localhost:3000 TEST_USER_TOKEN=<your-jwt> npm run test:reading-engine

# Run the Moments load test
API_URL=http://localhost:3000 TEST_USER_TOKEN=<your-jwt> npm run test:moments
```

## Test Scripts

| Script | File | Description |
|--------|------|-------------|
| `test:trust-safety` | `trust-and-safety.load.yml` | Load tests all Safety, Moderation, and Blocks endpoints |
| `test:spam-detection` | `spam-detection.load.yml` | Load tests the SpamDetectionService `/spam-detection/check` endpoint |
| `test:economy` | `economy.load.yml` | Load tests the Virtual Coin Economy: gift catalog, coin packages, balance, daily check-in, checkout, purchase, gift sending, sticker packs |
| `test:matchmaking` | `matchmaking.load.yml` | Load tests the Discovery/Matchmaking Algorithm: partner search, language pair matching, location search, partner of the week, audio intros, recent native speakers, spotlight |
| `test:matchmaking:report` | (output + HTML) | Runs the Matchmaking test and generates an HTML report |
| `test:trust-safety:report` | (output + HTML) | Runs the Trust & Safety test and generates an HTML report |
| `test:srs-flashcards` | `srs-flashcards.load.yml` | SRS flashcard creation, review (SM-2), and retrieval load testing |
| `test:srs-flashcards:report` | (output + HTML) | Runs the SRS Flashcards test and generates an HTML report |
| `test:escrow-payments` | `escrow-payments.load.yml` | Load tests the Escrow Payments endpoints |
| `test:escrow-payments:report` | (output + HTML) | Runs the Escrow Payments test and generates an HTML report |
| `test:video-classrooms` | `video-classrooms.load.yml` | Load tests the Video Classrooms endpoints (LiveKit room creation and joining) |
| `test:video-classrooms:report` | (output + HTML) | Runs the Video Classrooms test and generates an HTML report |
| `test:discovery-map` | `discovery-map.load.yml` | Load tests all Discovery Map endpoints including partner search, language pair matching, location search, audio intros, partner of the week, recent native speakers, and spotlight users |
| `test:discovery-map:report` | (output + HTML) | Runs the Discovery Map test and generates an HTML report |
| `test:reading-engine` | `reading-engine.load.yml` | Load tests the LingQ Reading Engine: resource CRUD, tokenisation, reading progress, and cache admin |
| `test:reading-engine:report` | (output + HTML) | Runs the Reading Engine test and generates an HTML report |
| `test:moments` | `moments.load.yml` | Load tests the Moments social feed: feed browsing, moment and story creation, language questions, likes, comments, correction voting, media upload URLs, editing, and pinning |
| `test:moments:report` | (output + HTML) | Runs the Moments test and generates an HTML report |

## Configuration

### Target URL

Override the target via the `-t` flag or `API_URL` env var:

```bash
npx artillery run -t https://staging.hellotalk.example.com trust-and-safety.load.yml
```

### Auth Token

Set the Supabase JWT via the `TEST_USER_TOKEN` environment variable:

```bash
TEST_USER_TOKEN="eyJhbGciOi..." npx artillery run trust-and-safety.load.yml
```

### Load Profiles

Both test scripts include the following phases:

1. **Warmup** (30s) - Gradual 1 VU/s introduction
2. **Ramp** (60s) - Linear increase from 5 to 20 VUs/s
3. **Sustained** (120s) - Constant 20 VUs/s
4. **Spike** (30s) - Burst at 50 VUs/s

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

### Discovery / Matchmaking Module (`/discovery`)
- `GET /discovery/partners` - Partner search with filters (language, level, distance, age, interests, serious learners, availability, learning goals, voice room, audio intro)
- `GET /discovery/partner-of-week` - Weekly partner of the week list
- `GET /discovery/audio-intros` - Audio intro discovery
- `GET /discovery/recent-native-speakers` - Recently joined native speakers
- `GET /discovery/spotlight` - Spotlight users
- `GET /discovery/language-pair` - Language pair matching
- `GET /discovery/search-by-location` - Location-based search by country/city

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

### Discovery Module (`/discovery`)
- `GET /discovery/partners` - Personalised partner search with filters (language, location, level, age, gender, interests, availability, serious learner mode)
- `GET /discovery/partner-of-week` - Partner of the Week cached list
- `GET /discovery/audio-intros` - Audio intro discovery with language filters
- `GET /discovery/recent-native-speakers` - Recently joined native speakers
- `GET /discovery/spotlight` - Spotlight user profiles
- `GET /discovery/language-pair` - Language pair matching with pagination and sorting
- `GET /discovery/search-by-location` - Location-based user search by country and city

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
