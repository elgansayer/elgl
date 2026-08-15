# 📚 HELLOTALK FEATURE SPECIFICATION (FEATURES_SPEC.md)

1:1 competitor to HelloTalk and Instagram with LingQ interactive reading, mapped to NestJS and Angular architecture.

## 1. Core Messaging & Chat (Centrifugo)

JSON payloads routed via Centrifugo, cached in Redis, persisted in Supabase.

- **Text:** Real-time bi-directional, typing indicators, read receipts.
- **Voice Notes:** Hold-to-record, uploaded to Cloudflare R2.
- **VoIP Audio:** 1-on-1 via LiveKit private rooms.
- **HD Video:** 1-on-1 via LiveKit.
- **Doodle:** HTML5 canvas drawing sent as image.
- **Media:** Camera, gallery, live GPS (static map images).
- **Favourites:** Save messages/audio to private `favourites` table.
- **Search:** Client-side index and server-side `pg_trgm`.
- **Gifts:** Digital stickers triggering Centrifugo global broadcast animations.
- **Groups:** Multi-user rooms (`group_{id}`), shared vocabulary, moderation.

## 2. AI & NLP (NestJS + Azure/DeepL + NLP.js)

- **Translation:** Tapping message translates to native language. 10/day free, unlimited VIP (8 UKP/$10 USD/mo).
- **Transliteration:** Phonetic Latin characters for non-Latin scripts.
- **Corrections (Diff):** User A edits User B. Angular renders diff (`{ type: 'correction', original: '...', fixed: '...' }`).
- **TTS:** AI audio pronunciation of text.
- **Transcription:** Voice-to-text for audio notes.
- **Grammar Checker:** Pre-send AI error flagging.
- **Pronunciation Scoring:** Backend grades accent/clarity out of 100.

## 3. Global Feed / "Moments" (Redis Fan-Out)

- **Multi-modal:** Text, up to 9 images, or 60s voice.
- **Community Corrections:** Visual diff embedded in comments.
- **Filtering:** "All", "Classmates", or "Following".
- **Audio Reading:** TTS for entire Moment.
- **Translation:** One-tap translation for Moment and comments.
- **Pinning:** VIPs can pin Moments.

## 4. Audio & Video Broadcasting (LiveKit)

- **24/7 Voice Rooms:** Categorised by language pair.
- **Stage Management:** Hosts, Speakers, Listeners. Listeners "Raise Hand" (`/audio-rooms/raise-hand`), Host grants LiveKit token (`canPublish: true`).
- **Text Chat Overlay:** Synchronised Centrifugo text chat (`room_{id}`).
- **Tags:** e.g. "Pronunciation Focus", "Beginners Only".
- **Live Streams (Video):** Broadcasts by teachers/popular users.
- **Co-hosting:** Video host invites viewer for 1-on-1 split-screen.
- **AI Subtitles:** Live speech-to-text captions.
- **Replays:** Archives saved to Cloudflare R2.

## 5. Discovery (Supabase PostGIS)

- **Goal Pairing:** Matches native/target languages.
- **Filters:** Country, City, Age, Gender, Proficiency.
- **"Serious Learner":** Filters for high correction ratios, streaks, completed profiles.
- **Time-zone:** Prioritises online users (Centrifugo presence).
- **Proximity:** Exact GPS radius (`ST_DWithin`).

## 6. Interactive Reading (LingQ Clone in Angular)

- **Tokenisation:** `Intl.Segmenter(locale, { granularity: 'word' })` parses text to clickable tokens.
- **Define:** Clicking token opens dictionaries, audio, examples.
- **SRS Vocabulary:** Saved words enter `flashcards` table:
  - Level 0: Blue (New)
  - Level 1-3: Yellow (Learning)
  - Level 4: White (Mastered)
- **Live Highlighting:** Tokens coloured by vocabulary state globally.
- **Audio-Sync:** `<audio>` `timeupdate` syncs with `Intl.Segmenter` spans.

## 7. Ecosystem & Sync

- **Desktop Web:** Syncs with mobile via QR. Keyboard-optimised.
- **Backups:** Syncs local message DB to cloud.
- **SSO:** Links to sister apps.

## 8. Monetisation & Economy

- **VIP (8 UKP / $10 USD/mo or 6 UKP / $8 USD/yr):** No ads, unlimited AI, 3 target languages, boosted search, incognito, higher contact limits.
- **Developer (20 UKP / $26 USD/mo):** API keys, analytics, custom bots.
- **Coins (`coins_balance`):** Stripe/App Store webhooks. Spent on Gifts, tips, tutoring.

## 9. Trust & Safety

- **Privacy:** Hide age, GPS, or global search profile.
- **Visitor Logs:** Shows profile viewers (blurred free, visible VIP).
- **Block & Report:** Flags user ID and context in Supabase admin.
