# HelloTalk Trust & Safety Load Testing Suite

Artillery load-testing suite for HelloTalk's Trust & Safety architecture, covering user reporting, blocking, moderation, and spam detection endpoints.

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

# Run the Admin Moderation Dashboard load test
API_URL=http://localhost:3000 TEST_ADMIN_TOKEN=<your-admin-jwt> npm run test:admin-moderation
```

## Test Scripts

| Script | File | Description |
|--------|------|-------------|
| `test:trust-safety` | `trust-and-safety.load.yml` | Load tests all Safety, Moderation, and Blocks endpoints |
| `test:spam-detection` | `spam-detection.load.yml` | Load tests the SpamDetectionService `/spam-detection/check` endpoint |
| `test:admin-moderation` | `admin-moderation.load.yml` | Load tests the Admin Moderation Dashboard (`/admin/*`) endpoints |
| `test:trust-safety:report` | (output + HTML) | Runs the Trust & Safety test and generates an HTML report |
| `test:admin-moderation:report` | (output + HTML) | Runs the Admin Moderation test and generates an HTML report |

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

### Admin Moderation Dashboard (`/admin`)
- `GET /admin/users` - List all users with pagination and search
- `GET /admin/users/:id/login-history` - User login history
- `PATCH /admin/users/:id/vip` - Set user VIP status
- `POST /admin/users/:id/ban` - Ban a user
- `POST /admin/users/:id/warn` - Warn a user
- `GET /admin/blocks` - List all blocks
- `DELETE /admin/blocks/:blockId` - Remove a block entry