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
```

## Test Scripts

| Script | File | Description |
|--------|------|-------------|
| `test:trust-safety` | `trust-and-safety.load.yml` | Load tests all Safety, Moderation, and Blocks endpoints |
| `test:spam-detection` | `spam-detection.load.yml` | Load tests the SpamDetectionService `/spam-detection/check` endpoint |
| `test:economy` | `economy.load.yml` | Load tests the Virtual Coin Economy: gift catalog, coin packages, balance, daily check-in, checkout, purchase, gift sending, sticker packs |
| `test:trust-safety:report` | (output + HTML) | Runs the Trust & Safety test and generates an HTML report |
| `test:srs-flashcards` | `srs-flashcards.load.yml` | SRS flashcard creation, review (SM-2), and retrieval load testing |
| `test:srs-flashcards:report` | (output + HTML) | Runs the SRS Flashcards test and generates an HTML report |
| `test:escrow-payments` | `escrow-payments.load.yml` | Load tests the Escrow Payments endpoints |
| `test:escrow-payments:report` | (output + HTML) | Runs the Escrow Payments test and generates an HTML report |

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
