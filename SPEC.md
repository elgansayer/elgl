# SPEC.md (The Architectural Blueprint)

## 1. Database Schema (Supabase PostgreSQL)
You will implement the following relational schema:

*   **Table: `users`**
    *   `id` (UUID, Primary Key, references auth.users)
    *   `display_name` (Text)
    *   `native_language` (String, ISO 639-1 code)
    *   `target_language` (String, ISO 639-1 code)
    *   `bio_text` (Text)
    *   `audio_intro_url` (Text, Cloudflare R2 URL)
    *   `location` (Geography Point 4326, via PostGIS)
    *   `mock_location` (Geography Point 4326, used if `is_vip` is true)
    *   `is_vip` (Boolean, default false)
    *   `coins_balance` (Integer, default 0)
    *   `created_at` (Timestamp)

*   **Table: `moments` (The Social Feed)**
    *   `id` (UUID, Primary Key)
    *   `author_id` (UUID, Foreign Key)
    *   `content_text` (Text)
    *   `media_url` (Text, nullable)
    *   `detected_language` (String, generated via NLP.js)
    *   `created_at` (Timestamp)

*   **Table: `flashcards` (LingQ & SRS System)**
    *   `id` (UUID, Primary Key)
    *   `user_id` (UUID, Foreign Key)
    *   `word_token` (Text)
    *   `translation` (Text)
    *   `context_sentence` (Text)
    *   `srs_level` (Integer, 0 to 4. 0=Blue/New, 1-3=Yellow/Learning, 4=White/Known)
    *   `next_review_date` (Timestamp)

*   **Table: `profile_visits`**
    *   `visitor_id` (UUID, Foreign Key)
    *   `viewed_id` (UUID, Foreign Key)
    *   `created_at` (Timestamp)

## 2. Backend Routing & Integrations (NestJS)
*   **Auth Module:** Generates JWTs for Centrifugo and LiveKit using `livekit-server-sdk`.
*   **Proximity Module:** Executes PostGIS queries: `SELECT * FROM users WHERE ST_DWithin(location, user_location, radius)`. If a user queries the endpoint, check `is_vip`. If true, allow them to pass a custom `mock_location` payload to spoof travel.
*   **Feed Fan-Out Module:** When a POST request hits `/moments`, save to Supabase, then use the Redis client to push the `moment_id` into the `timeline_queue:{follower_id}` list for all followers.
*   **Translation Module:** Integrates with Azure AI Translator or DeepL. Tracks daily translation limits in Redis. Free users get 10 per day. VIP users (8 UKP / $10 USD per month) get unlimited.

## 3. Real-Time Chat Architecture (Centrifugo)
*   **Connection:** Angular client uses `centrifuge-js` to establish a WebSocket connection.
*   **Channels:** Every 1-on-1 chat creates a private channel named `chat_{userA}_{userB}`.
*   **Payloads:** Messages are JSON payloads. Text messages look like `{ type: 'text', content: 'Hello' }`. Visual corrections look like `{ type: 'correction', original: 'I goes', fixed: 'I go' }`.

## 4. Live Audio Rooms Architecture (LiveKit)
*   **SFU Routing:** Angular clients connect to the LiveKit server. 
*   **Permissions:** By default, NestJS issues a LiveKit token with `roomJoin: true` and `canPublish: false`.
*   **Stage Protocol:** To speak, a listener triggers a NestJS API endpoint `/audio-rooms/raise-hand`. The room admin approves it, and NestJS returns a refreshed token with `canPublish: true`.

## 5. Interactive Reading Engine (LingQ Clone in Angular)
*   **The Component:** The `TokenisedTextComponent` accepts a raw string.
*   **Processing:** It runs `const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })`.
*   **Rendering:** It loops through the `segments` iterator. It checks an Angular Signal containing the user's vocabulary state. If the word exists in `flashcards`, it applies the correct CSS colour class (Blue, Yellow, or White).
*   **Audio Sync:** If an audio file is attached, bind to the HTML5 `<audio>` `timeupdate` event to highlight spans matching the timestamp.
