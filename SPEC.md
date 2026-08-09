# SPEC.md (The Architectural Blueprint)

## 1. Database Schema (Supabase PostgreSQL)

We implement a robust, highly indexed relational schema in Supabase (`PostgreSQL`) utilizing `PostGIS` for spatial proximity matching and `pg_trgm` for full-text search across moments and messages.

### Table: `users`

- `id` (UUID, Primary Key, references `auth.users`)
- `display_name` (Text, indexed)
- `native_language` (String, ISO 639-1 code, e.g., `'en'`, `'es'`, `'ar'`, indexed)
- `target_languages` (Array of Strings, ISO 639-1 codes; max 1 for free users, max 3 for VIP)
- `bio_text` (Text)
- `avatar_url` (Text, Cloudflare R2 URL)
- `audio_intro_url` (Text, Cloudflare R2 URL)
- `location` (Geography Point 4326, spatial index via `PostGIS`)
- `mock_location` (Geography Point 4326, used if `is_vip` is true to spoof location)
- `is_vip` (Boolean, default `false`, indexed)
- `vip_tier` (String, `'free'`, `'consumer_8_ukp_10_usd'`, `'developer_20_ukp_26_usd'`, default `'free'`)
- `coins_balance` (Integer, default `0`)
- `study_streak_days` (Integer, default `1`)
- `correction_ratio` (Float, ratio of corrections given vs received, default `1.0`)
- `is_serious_learner` (Boolean, calculated boolean based on streak > 7 and correction_ratio >= 0.8)
- `privacy_hide_age` (Boolean, default `false`)
- `privacy_hide_location` (Boolean, default `false`)
- `privacy_hide_from_search` (Boolean, default `false`)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `profile_visits`

- `id` (UUID, Primary Key)
- `visitor_id` (UUID, Foreign Key referencing `users.id`)
- `viewed_id` (UUID, Foreign Key referencing `users.id`, indexed)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `moments` (The Global Social Feed)

- `id` (UUID, Primary Key)
- `author_id` (UUID, Foreign Key referencing `users.id`, indexed)
- `content_text` (Text)
- `media_urls` (Array of Text, Cloudflare R2 URLs for up to 9 images or video)
- `voice_note_url` (Text, Cloudflare R2 URL for up to 60-second audio clip)
- `detected_language` (String, generated via `NLP.js` or Azure)
- `is_pinned` (Boolean, default `false`)
- `likes_count` (Integer, default `0`)
- `comments_count` (Integer, default `0`)
- `created_at` (Timestamp with time zone, default `now()`, indexed)

### Table: `moment_comments`

- `id` (UUID, Primary Key)
- `moment_id` (UUID, Foreign Key referencing `moments.id`, indexed)
- `author_id` (UUID, Foreign Key referencing `users.id`)
- `content_text` (Text)
- `correction_payload` (JSONB, nullable, e.g., `{ "original": "...", "fixed": "...", "explanation": "..." }`)
- `voice_note_url` (Text, nullable)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `moment_likes`

- `id` (UUID, Primary Key)
- `moment_id` (UUID, Foreign Key referencing `moments.id`, indexed)
- `user_id` (UUID, Foreign Key referencing `users.id`)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `flashcards` (LingQ Interactive Reading & SRS Vocabulary Bank)

- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key referencing `users.id`, indexed)
- `word_token` (Text, exact lowercase word token extracted via `Intl.Segmenter`)
- `source_language` (String, ISO 639-1 code)
- `translation` (Text)
- `context_sentence` (Text)
- `audio_pronunciation_url` (Text, nullable)
- `srs_level` (Integer, `0` to `4`: `0`=Blue/New, `1` to `3`=Yellow/Learning, `4`=White/Known)
- `next_review_date` (Timestamp with time zone, indexed)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `chat_messages`

- `id` (UUID, Primary Key)
- `channel_id` (Text, indexed, e.g., `'chat_userA_userB'` or `'group_123'`)
- `sender_id` (UUID, Foreign Key referencing `users.id`)
- `payload_type` (String: `'text'`, `'voice'`, `'image'`, `'doodle'`, `'correction'`, `'call_invite'`, `'gift'`)
- `content_json` (JSONB, structure varies depending on `payload_type`)
- `is_read` (Boolean, default `false`)
- `created_at` (Timestamp with time zone, default `now()`, indexed)

### Table: `favourites` (Bookmarked Messages, Corrections & Audio)

- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key referencing `users.id`, indexed)
- `item_type` (String: `'message'`, `'correction'`, `'audio'`, `'moment'`)
- `item_payload` (JSONB, stores copy of the bookmarked item)
- `notes` (Text, user study notes)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `audio_rooms` (LiveKit 24/7 Voice & Video Rooms)

- `id` (UUID, Primary Key)
- `room_name` (Text, unique indexed)
- `host_id` (UUID, Foreign Key referencing `users.id`)
- `language_pair` (String, e.g., `'en-es'`, `'ar-en'`)
- `topic_tag` (String, e.g., `'Pronunciation'`, `'Beginners'`, `'Cultural Exchange'`)
- `is_video_stream` (Boolean, default `false`)
- `is_active` (Boolean, default `true`, indexed)
- `participants_count` (Integer, default `1`)
- `created_at` (Timestamp with time zone, default `now()`)

### Table: `blocks` & `reports` (Trust and Safety)

- `blocks`: `id`, `blocker_id`, `blocked_id`, `created_at`
- `reports`: `id`, `reporter_id`, `reported_user_id`, `reason_category`, `description`, `context_url`, `status`, `created_at`

---

## 2. Backend Routing & Integrations (NestJS Modules)

### AuthModule & Security

- Validates Supabase JWTs using custom `SupabaseAuthGuard`.
- Mints Centrifugo connection tokens (`centrifuge.token()`) with sub claims matching `users.id`.
- Mints LiveKit room access tokens using `livekit-server-sdk` with fine-grained participant grants (`roomJoin: true`, `canPublish: false` for listeners; `canPublish: true` when promoted).

### Discovery & Proximity Module

- Executes PostGIS geospatial queries:
  ```sql
  SELECT *, ST_Distance(location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as distance
  FROM users
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :radius_metres)
    AND privacy_hide_from_search = false
    AND id != :current_user_id
  ORDER BY distance ASC LIMIT 50;
  ```
- **VIP Location Spoofing Check:** If `user.is_vip === true` and `user.mock_location` is set, overrides real GPS coordinates before running queries.
- **Serious Learner Algorithm:** Filters where `is_serious_learner = true` (`study_streak_days > 7` and `correction_ratio >= 0.8`).

### Feed Fan-Out Module (Redis + Supabase)

- **Publish Flow:** `POST /moments` saves moment to `moments` table, then pushes `moment.id` asynchronously via NestJS background queue (`BullMQ` or native Redis `RPUSH`) into `timeline_queue:{follower_id}` for all followers (and language classmates).
- **Feed Retrieval:** `GET /moments/feed?filter=all|classmates|following` fetches top 20 IDs from Redis list using `LRANGE`, then retrieves full hydrated objects from Supabase.

### NLP & AI Module

- **Language Detection:** Uses `NLP.js` server-side model to auto-detect language of incoming moments and messages.
- **Translation & Transliteration:** Routes to Azure AI Translator API / DeepL.
- **Redis Rate Limiter:** Checks key `daily_ai_usage:{user_id}:{YYYY-MM-DD}`. Free users get max 10 calls/day. VIP tier (8 UKP / $10 USD per month) bypasses limits entirely.
- **Pronunciation Scoring:** Accepts audio blob URL, submits to speech assessment API, returns score out of 100 with phoneme breakdown.

---

## 3. Real-Time Chat Architecture (Centrifugo + Redis)

### Channels & Routing

- **1-on-1 Chats:** Private channel `chat_{min(userA, userB)}_{max(userA, userB)}`.
- **Group Chats:** Channel `group_{room_uuid}`.
- **Audio Room Chat Overlay:** Channel `room_{audio_room_id}`.
- **Global Notifications & Gift Broadcasts:** User personal channel `user_{user_id}` and global broadcast channel `global_announcements`.

### JSON Message Payloads

- **Text:** `{ "type": "text", "content": "Hello world", "replyToId": null }`
- **Correction:** `{ "type": "correction", "original": "I goes to school", "fixed": "I go to school", "notes": "Subject-verb agreement" }`
- **Voice Note:** `{ "type": "voice", "url": "https://r2.cdn.com/audio/clip123.mp3", "durationSec": 14, "transcript": "Hello how are you" }`
- **Doodle:** `{ "type": "doodle", "imageUrl": "https://r2.cdn.com/doodles/draw123.png" }`
- **Virtual Gift:** `{ "type": "gift", "giftId": "golden_dragon", "coinValue": 50, "animationUrl": "https://r2.cdn.com/animations/dragon.json" }`

---

## 4. Live Audio & Video Rooms Architecture (LiveKit SFU)

- **Room Creation:** `POST /audio-rooms/create` creates room in database and initialises LiveKit room via `RoomServiceClient`.
- **Stage Protocol (Raise Hand):**
  1. Listener emits `/audio-rooms/raise-hand` payload via REST or Centrifugo.
  2. Room Host receives notification and calls `POST /audio-rooms/approve-speaker`.
  3. NestJS calls `AccessToken` API to issue refreshed JWT with `canPublish: true` (`canPublishData: true`).
- **Subtitles & Speech-to-Text:** Audio tracks published to LiveKit are forwarded to STT worker, broadcasting closed captions onto Centrifugo `room_{id}` channel.

---

## 5. LingQ Clone Interactive Reading Engine (Angular Signal Architecture)

### TokenisedTextComponent Design

```typescript
@Component({
  selector: 'app-tokenised-text',
  template: `
    <span class="inline-block" *ngFor="let segment of segments()">
      <span
        *ngIf="segment.isWordLike; else punctuation"
        [ngClass]="getWordClass(segment.segment)"
        (click)="onWordClick(segment.segment)"
        class="cursor-pointer transition-colors duration-150 rounded px-0.5 py-0.2"
      >
        {{ segment.segment }}
      </span>
      <ng-template #punctuation>
        <span>{{ segment.segment }}</span>
      </ng-template>
    </span>
  `,
})
export class TokenisedTextComponent {
  text = input.required<string>();
  locale = input.required<string>();
  vocabularyMap = input.required<Map<string, number>>(); // word -> srs_level

  segments = computed(() => {
    const segmenter = new Intl.Segmenter(this.locale(), { granularity: 'word' });
    return Array.from(segmenter.segment(this.text()));
  });

  getWordClass(word: string): string {
    const cleanToken = word.toLowerCase().trim();
    if (!this.vocabularyMap().has(cleanToken)) {
      return 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border-b border-blue-400'; // Level 0: Blue (New)
    }
    const level = this.vocabularyMap().get(cleanToken);
    if (level === 4) {
      return 'text-slate-200 hover:bg-slate-700/30'; // Level 4: White (Known)
    }
    return 'bg-yellow-500/30 text-yellow-200 hover:bg-yellow-500/50 border-b border-yellow-400'; // Level 1-3: Yellow (Learning)
  }
}
```

### Audio Synchronisation (`timeupdate`)

- When reading articles or voice transcripts, `<audio>` emits `timeupdate` (every ~200ms).
- The component matches `audio.currentTime` against time-stamped word boundaries to apply an active highlight ring (`ring-2 ring-purple-400 scale-105`) to the currently spoken token.

---

## 6. Globalisation & RTL Mirroring (Tailwind Logical Properties)

- All padding, margins, borders, and positioning in Angular templates strictly use `ps-` (padding start), `pe-` (padding end), `ms-`, `me-`, `text-start`, `text-end`, `border-s`, and `border-e`.
- When a user whose native language is Arabic (`ar`), Hebrew (`he`), or Persian (`fa`) logs in, the root `<html [dir]="isRtl() ? 'rtl' : 'ltr'">` binding instantly mirrors all UI components, flex rows, and navigation bars.

---

## 7. Infrastructure, Containerisation & 24/7 VPS Autonomous Deployment Blueprint

To support continuous autonomous development and 24/7 production operation on a cloud Virtual Private Server (VPS), the system architecture enforces rigorous containerisation and configuration guarantees:

### Docker Compose Container Orchestration (`docker-compose.yml`)

- **`api` (NestJS Backend):** Runs under Node.js (`20-alpine`) with multi-stage Dockerfile (`target: production`). Restarts on failure (`restart: always`).
- **`web` (Angular Frontend):** Built using multi-stage build (`ng build`) served via high-performance Nginx (`nginx:alpine`) with gzip/brotli compression and reverse proxying to `/api`, `/centrifugo`, and `/rtc`.
- **`cache` (Redis 7 Alpine):** Dedicated instance with append-only persistence (`--appendonly yes`) for Centrifugo pub/sub, `BullMQ` timeline worker queues, and daily AI rate limiting (`daily_ai_usage`).
- **`websocket` (Centrifugo v5):** Runs alongside the API, exposing WebSocket connection ports (`8000`) and internal HTTP API (`8001`) for NestJS message publishing.
- **`sfu` (LiveKit Server v2):** WebRTC media router configured with external IP discovery (`use_external_ip: true`) when deployed on cloud VPS.

### Environment Schema & Configuration Validation (`@nestjs/config`)

- To prevent autonomous deployment crashes on the VPS, NestJS uses strict environment variable schema validation (`Joi` or `Zod` validation schema in `ConfigModule.forRoot()`).
- Required parameters: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `CENTRIFUGO_API_KEY`, `CENTRIFUGO_SECRET`, `LIVEKIT_API_KEY`, `LIVEKIT_SECRET`, `LIVEKIT_URL`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, `DEEPL_API_KEY`, `AZURE_TRANSLATOR_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

### LiveKit WebRTC SFU Networking & Firewall Rules (24/7 VPS)

- When running on a cloud VPS, the following firewall (`ufw`/`iptables`) ports must be open and forwarded directly to the `sfu` container:
  - **`7880/tcp`**: LiveKit HTTP & WebSocket API (used by Angular client and NestJS token minting).
  - **`7881/tcp`**: LiveKit WebRTC over TCP (fallback when UDP is blocked).
  - **`50000-60000/udp`**: WebRTC SFU media routing (essential for low-latency voice rooms and video streams).

### LingQ High-Performance UI Rendering

- To maintain 60 FPS on mobile and desktop browsers when rendering large chat histories (`100+` messages) or extensive LingQ reading articles (`2,000+` word tokens):
  - **Virtual Scrolling:** Chat message lists and long articles strictly use `@angular/cdk/scrolling` (`cdk-virtual-scroll-viewport`).
  - **Memoized Segmenter & Signals:** The `TokenisedTextComponent` caches `Intl.Segmenter` output via computed signals and tracks word nodes with strict `trackBy` / `@for (segment of segments(); track $index)` syntax.
