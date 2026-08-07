import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded, Request, Response } from 'express';
import helmet from 'helmet';
import { SanitiseHtmlPipe } from './common/pipes/sanitise-html.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.setGlobalPrefix('api');

  // Ensure raw body is preserved for Stripe webhook
  app.use(
    json({
      verify: (
        req: Request & { rawBody?: Buffer },
        _res: Response,
        buf: Buffer,
      ) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (
        req: Request & { rawBody?: Buffer },
        _res: Response,
        buf: Buffer,
      ) => {
        req.rawBody = buf;
      },
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new SanitiseHtmlPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('HelloTalk Clone API')
    .setDescription(
      `The HelloTalk Clone API provides endpoints for language exchange, social networking, real-time messaging, and administrative operations.

## Spaced Repetition (SRS) -- Technical Architecture

The Spaced Repetition System (SRS) powers the vocabulary learning engine, enabling users to memorise words efficiently through scientifically-backed scheduling. It is built on the **SM-2 algorithm** (SuperMemo 2), an evidence-based spaced repetition model that optimises review intervals based on user recall performance.

### Architecture Overview

The SRS subsystem spans three controllers under the \`/api\` prefix:

| Controller | Base Path | Purpose |
|---|---|---|
| **Flashcards** | \`/api/flashcards\` | Core CRUD for vocabulary cards and SM-2 review submission |
| **Flashcards / Suggest** | \`/api/flashcards/suggest\` | NLP-driven word-suggestion engine powered by \`Intl.Segmenter\` |
| **Decks** | \`/api/decks\` | Thematic grouping of flashcards (e.g., "Travel Phrases", "French Basics") |

### SM-2 Algorithm (SuperMemo 2)

The SM-2 algorithm is the computational heart of the SRS. It takes a **quality score** (0-5) from the user after each review and computes:

- **Easiness Factor (EF)** -- A multiplier that grows when the user recalls easily and shrinks after failures. Floor-clamped at 1.3.
- **Repetitions** -- The count of consecutive successful recalls. Resets to 0 on failure (quality < 3).
- **Interval** -- The number of days until the next review. Grows exponentially: 1 day, 6 days, then \`interval x EF\`.
- **SRS Level** -- A coarse 0-4 bucket derived from the SM-2 state for backwards compatibility:
  - **0: Blue / New** -- Freshly added; never reviewed
  - **1-3: Yellow / Learning** -- Under active acquisition
  - **4: White / Known** -- Mastered (interval >= 21 days); excluded from "due" queries

### Data Flow

1. **Create Flashcard** (\`POST /api/flashcards\`): User taps a word in the interactive reader. The word token, translation, definition, and optional context/pronunciation URL are upserted into the \`flashcards\` table. XP awarded for \`create_flashcard\`.
2. **Suggest Vocabulary** (\`GET /api/flashcards/suggest\`): A chat message or article text is tokenised via \`Intl.Segmenter\` into unique word tokens. Already-known words (SRS level 4) are optionally filtered out.
3. **SRS Review** (\`PATCH /api/flashcards/:id/srs\`): User rates recall quality (0-5). SM-2 recalculates EF, repetitions, interval, and \`next_review_at\`. XP awarded for \`review_flashcard\`. Metrics recorded (quality, pass/fail, review duration).
4. **Due Reviews** (\`GET /api/flashcards/due\`): Returns flashcards with \`srs_level < 4\` and \`next_review_at <= now\`, ordered most-overdue first.
5. **Deck Management** (\`/api/decks\`): Users organise flashcards into named, coloured decks with icons. Many-to-many via \`deck_flashcards\` junction table.

### Rate Limiting & Guards

All SRS endpoints are protected by:
- **SupabaseAuthGuard**: Validates Supabase JWTs (Bearer authentication).
- **SrsRateLimiterGuard**: Enforces per-user rate limits with custom \`@SrsRateLimit\` decorators.
- **ThrottlerGuard** (\`@nestjs/throttler\`): Secondary global rate limit layer.

### Database Tables

- **\`flashcards\`** -- Core vocabulary cards with SM-2 scheduling state (\`easiness_factor\`, \`repetitions\`, \`interval_days\`, \`next_review_at\`, \`srs_level\`).
- **\`decks\`** -- User-created thematic deck containers with name, description, colour, and icon.
- **\`deck_flashcards\`** -- Junction table for many-to-many deck-flashcard relationships.

### Backend Services

- **FlashcardsService** -- Implements SM-2 algorithm (\`applySm2Algorithm\`), CRUD operations, due-review queries, XP awarding, and Prometheus metrics via \`MetricsService\`.
- **SuggestFlashcardsService** -- NLP tokenisation (\`Intl.Segmenter\`) and known-word filtering.
- **DecksService** -- Deck CRUD and deck-flashcard association management.
- **SrsRateLimiterGuard** -- Custom guard with \`@SrsRateLimit\` decorator for per-endpoint rate windows.
- **XpService** -- Awards XP for \`create_flashcard\` (5 XP) and \`review_flashcard\` (2 XP).
- **MetricsService** -- Records SRS flashcard creation (\`recordSrsFlashcardCreated\`) and review completion (\`recordSrsReviewCompleted\`) to Prometheus.

### Resilience

All Supabase calls use \`withRetry()\` from \`src/common/retry.ts\`, which implements exponential backoff with jitter for HTTP 429 (Too Many Requests) responses from the Supabase PostgREST API.

---

## Admin Moderation Dashboard
The Admin Moderation Dashboard exposes REST endpoints under \`/api/admin\` and \`/api/moderation\` for managing users, blocks, reports, and content moderation workflows. All admin endpoints require **Bearer** authentication with an admin role.

### Key Capabilities
- **User Management**: List, search, ban, warn users; manage VIP status; view login history.
- **Block Management**: List and remove user blocks across the platform.
- **Moderation Queue**: Fetch pending reports (moment and profile types), approve or reject flagged content.
- **Behaviour Analysis**: Analyse user profiles and moment content for dating-behaviour risk scoring.

### Authentication
Include a Supabase-issued JWT in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

### Pagination
Paginated endpoints accept \`page\` (default 1) and \`pageSize\` (default 20, max 100) query parameters.

### Rate Limiting
All endpoints are rate-limited via \`@nestjs/throttler\`. Check individual endpoint documentation for specific limits.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag(
      'Spaced Repetition (SRS)',
      'Core vocabulary flashcard management -- create/upsert flashcards, submit SM-2 spaced repetition reviews, list/due queries',
    )
    .addTag(
      'Spaced Repetition (SRS) / Suggest',
      'NLP-driven vocabulary suggestion engine -- tokenises text via Intl.Segmenter and suggests unknown words for flashcard creation',
    )
    .addTag(
      'Spaced Repetition (SRS) / Decks',
      'Thematic flashcard deck management -- create, update, delete decks; add/remove flashcards to/from decks',
    )
    .addTag('Admin - Users', 'Administrative user management operations')
    .addTag('Admin - Blocks', 'Administrative block management operations')
    .addTag('Moderation', 'Content moderation and reporting operations')
    .addTag('Escrow Payments', 'Escrow-based coin payment transactions between users with circuit breaker resilience')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
