# 📚 HELLOTALK EXHAUSTIVE FEATURE SPECIFICATION (FEATURES_SPEC.md)

This document outlines every micro-feature required to build a 1:1 competitor to HelloTalk and Instagram with LingQ interactive reading functionality, mapped directly to our NestJS and Angular architecture.

## 1. Core Messaging & Chat Engine (Powered by Centrifugo)

The direct messaging ecosystem is highly structured. Messages are not just strings: they are complex JSON payloads routed via Centrifugo and cached in Redis before persistence in Supabase.

- **Text Messaging:** Real-time bi-directional chat with typing indicators and read receipts.
- **Asynchronous Voice Notes:** Hold-to-record audio snippets uploaded to Cloudflare R2, sending the URL as the message payload.
- **VoIP Audio Calling:** 1-on-1 internet phone calls established via LiveKit private rooms.
- **High-Definition Video Calling:** Direct face-to-face practice sessions, also routed through LiveKit.
- **Doodle Tool:** An integrated HTML5 canvas allowing users to draw on their screen and send the resulting image to explain concepts visually.
- **Media Sharing:** Camera integration, gallery uploads, and live GPS location sharing (rendered as static map images).
- **Favourites (Bookmarking):** Users can save specific messages, corrections, or audio clips into a private `favourites` table in Supabase for later revision.
- **Message Search:** Local client-side indexing and server-side `pg_trgm` search to query chat history instantly.
- **Virtual Gifts:** Sending digital, animated stickers or greeting cards, triggering Centrifugo global broadcast events to render full-screen animations.
- **Group Chats:** Multi-user language exchange rooms (`group_{id}`) supporting collaborative learning, shared vocabulary banks, and group moderation.

## 2. Artificial Intelligence & NLP Tools (Powered by NestJS + Azure/DeepL + NLP.js)

These are the built-in utilities that make the app an educational superpower rather than just a social messaging app.

- **In-line Translation:** Tapping any message triggers a backend request to translate the text into the user's native language (supporting 260+ languages). Tracks daily usage caps in Redis (10/day for free tier, unlimited for VIP at 8 UKP / $10 USD per month).
- **Transliteration (Romaji/Pinyin/Cyrillic):** Instantly converts non-Latin scripts into phonetic Latin characters to aid reading.
- **Native Speaker Corrections (Visual Diff):** A specific UI modal where User A edits User B's text. The Angular frontend renders the original text with red strikethroughs and the new text in green using structured JSON diffs (`{ type: 'correction', original: '...', fixed: '...' }`).
- **Text-to-Voice (TTS):** Tapping text plays an AI-generated audio pronunciation of the sentence.
- **Voice-to-Text (Transcription):** Converts an incoming voice note into a readable text transcript using backend speech-to-text APIs.
- **AI Grammar Checker:** A pre-send tool. Users type a draft, hit the grammar button, and the AI flags errors before the message is sent.
- **AI Pronunciation Scoring:** Users record a phrase, and the backend grades their accent, intonation, and clarity out of 100.

## 3. Global Social Feed / "Moments" (Powered by Redis Fan-Out)

The Instagram-style community feed where users post public updates, cultural moments, and language questions.

- **Multi-modal Posts:** Users can post text, up to 9 images, or 60-second voice recordings to the public timeline.
- **Community Corrections:** The visual diff correction tool is embedded directly in the comment section of every post.
- **Feed Filtering:** Users can filter the feed by "All", "Classmates" (users learning the same language), or "Following".
- **Audio Reading of Posts:** A button that commands the text-to-speech engine to read the entire text of a Moment aloud.
- **Post Translation:** One-tap translation for entire Moments and their nested comment threads.
- **Profile Pinning:** VIP users can pin specific Moments to the top of their profile.

## 4. Audio & Video Broadcasting (Powered by LiveKit)

The massive real-time community engagement and voice practice features.

- **24/7 Drop-in Voice Rooms:** Public audio rooms categorised by language pair.
- **Roles & Stage Management:** Rooms contain Hosts, Speakers (on stage), and Listeners (audience). Listeners must click "Raise Hand" (`/audio-rooms/raise-hand`) and be approved by the Host to be granted a LiveKit publishing token (`canPublish: true`).
- **Text Chat Overlay:** A synchronised Centrifugo text chat (`room_{id}`) that runs alongside the live audio.
- **Topic Specialisation:** Rooms are tagged (e.g., "Pronunciation Focus", "Cultural Exchange", "Beginners Only").
- **Live Streams (Video):** Professional host broadcasting, usually run by certified language teachers or popular community members.
- **Co-hosting (Joining the Stage):** The video host can invite a viewer to turn on their camera and join a split-screen 1-on-1 conversation.
- **Real-Time AI Subtitles:** Live speech-to-text generating closed captions for speakers on stage.
- **Stream Replays:** Recorded archives of previous video lessons saved to Cloudflare R2.

## 5. Matchmaking & Discovery (Powered by Supabase PostGIS)

The search engine used to find the perfect language exchange partners globally and locally.

- **Goal-Based Pairing:** Matches users based on precise native language and target language alignment.
- **Advanced Search Filters:** Filtering by Country, City, Age range, Gender, and Proficiency level.
- **"Serious Learner" Toggle:** An algorithmic filter that hides casual users and prioritises accounts with high correction ratios, active study streaks, and completed profiles.
- **Time-zone Optimisation:** Prioritises showing users who are currently awake and online (tracked via Centrifugo presence).
- **Proximity Search:** Exact GPS radius searching (`ST_DWithin`) to find language partners in your physical city.

## 6. Interactive Reading Engine (LingQ Clone in Angular)

The deep immersion reading and vocabulary acquisition system integrated throughout Moments, Chat, and dedicated Reading articles.

- **Universal Word Tokenisation:** Every word in any text is parsed using native `Intl.Segmenter(locale, { granularity: 'word' })` to turn plain text into clickable word tokens.
- **Click-to-Translate & Define:** Clicking any word token opens an instant pop-up showing dictionaries, audio pronunciation, and example sentences.
- **Spaced Repetition System (SRS) Vocabulary List:** Clicking and saving a word adds it to the user's `flashcards` table with SRS levels:
  - Level 0: Blue (New / Unknown token encountered)
  - Level 1-3: Yellow (Learning / In review queue)
  - Level 4: White (Known / Mastered vocabulary)
- **Live Vocabulary Highlighting:** Wherever text appears (Chat messages, Moments, Reading texts), word tokens are dynamically styled with CSS colours reflecting the user's personal vocabulary state.
- **Audio-Synchronised Reading:** When reading articles or listening to voice recordings with transcripts, the `<audio>` `timeupdate` event synchronises with the `Intl.Segmenter` spans to highlight the currently spoken phrase in real time.

## 7. Ecosystem & Multi-Platform Sync

- **Desktop Web Platform:** A browser-based version of the chat interface, syncing seamlessly with the mobile app via QR code login. Designed for faster typing and keyboard-optimised workflows.
- **Cloud Chat Backups:** Syncing the local message database to the cloud to persist message histories across devices.
- **Sister App Integrations:** Single-sign-on (SSO) links to vocabulary builders and AI avatar conversational bots.

## 8. VIP Premium Monetisation & Virtual Economy

The logic enforced by NestJS to drive subscriptions across tiers and power the in-app economy.

- **Consumer VIP Tier (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent):**
  - Ad Removal: Strips all banner and interstitial advertising from the UI.
  - Unlimited AI Tool Usage: Removes the daily cap on translations, transcriptions, and transliterations.
  - Multi-Language Unlocks: Allows studying up to 3 target languages simultaneously (the free tier is locked to 1).
  - Boosted Search Exposure: Algorithmic priority in the matchmaking database.
  - Incognito Mode: Allows browsing other profiles without triggering their "Who Viewed Me" notification logs.
  - Expanded Contact Limits: Increases the number of new user conversations that can be initiated per day.
- **Developer & Creator Tier (20 UKP / $26 USD per month):** API key generation, advanced analytics, and custom educational bot creation tools.
- **Virtual Coins Economy (`coins_balance`):** Purchasing virtual coin bundles via Stripe/App Store webhooks. Coins are spent on Virtual Gifts, Audio Room tips for hosts, and premium tutoring sessions.

## 9. Trust, Safety, and Privacy Management

- **Granular Privacy Toggles:** Users can hide their age, hide their exact GPS location, or remove themselves from global search entirely.
- **Visitor Logs ("Who Viewed Me"):** A dashboard showing exactly who has clicked on a profile (blurred for free users, fully visible for VIPs).
- **Block & Report System:** Essential moderation tools to combat inappropriate behaviour, scammers, and spam. Reports flag the user ID and message/moment context in the Supabase admin dashboard.
