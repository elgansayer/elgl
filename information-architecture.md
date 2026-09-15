# HelloTalk Information Architecture Audit & Consolidation

## 1. Current State & Route Mapping

The application currently has a sprawling top-level routing structure. Many features have grown organically, resulting in top-level aliases, fragmented experiences, and redundant pathways.

### Core & Navigation
- `/home` - Main landing experience
- `/ai-conversation` - AI Conversation (Fallback route)

### Social & Discovery
- `/discovery` - Partner discovery
- `/study-buddy` - Serious learning partner matching (Overlaps with Discovery)
- `/moments` - Social timeline
- `/profile`, `/profile/:userId`, `/profile/:userId/followers`, `/profile/:userId/following`
- `/visitors` ➡️ `/profile/visitors` (Alias)
- `/favourites` - Saved content
- `/hobby-tags` - Hobby/interest management

### Community & Groups
- `/community` - Main communities landing
- `/communities` ➡️ `/community` (Alias)
- `/groups` - Groups discovery
- `/groups/create` ➡️ `/community/groups/create` (Alias)
- `/join`, `/join/:code` - Join a group
- `/language-parties` ➡️ `/community/language-parties` (Alias)
- `/language-islands` ➡️ `/community/language-islands` (Alias)
- `/events`, `/events/calendar` - Events feed and calendar

### Messaging & Communication
- `/chat` - Conversation inbox
- `/chat/:id` - Direct/group messaging
- `/chat-settings` ➡️ `/settings/chat` (Alias)

### Live Media & Classrooms
- `/audio-rooms` - Live audio rooms
- `/preview/room/:id`, `/voiceroom-notes/:roomId`, `/host-dashboard` - Room management
- `/video-call`, `/active-call` - Real-time calling
- `/call-logs` - Call history
- `/classrooms` - Video classrooms marketplace

### Learning & Gamification
- `/vocabulary`, `/decks`, `/review`, `/suggest-flashcards` - Flashcards & SRS
- `/diagnostic-quiz`, `/proficiency` - Level assessment
- `/lessons` - Structured learning content
- `/read` - LingQ reading engine
- `/resource-library` - Resource library
- `/pronunciation-feedback` - Pronunciation AI
- `/stats`, `/milestones`, `/study-streak`, `/leaderboard`, `/quests` - Fragmented gamification/progress (Overlap)

### Monetisation & Economy
- `/vip` ➡️ `/subscription` (Alias)
- `/subscription`, `/subscription/success`, `/subscription/cancel`
- `/my-subscription` ➡️ `/settings/subscription` (Alias)
- `/shop`, `/sticker-store`, `/cart` - Virtual goods
- `/coin-economy`, `/coins/success`, `/coins/cancel` - Virtual currency
- `/escrow`, `/escrow/:id` - Escrow payments

### Settings & Admin
- `/settings` - Main preferences hub
- `/settings/*` - Extensive sub-routes (Account, Privacy, Notification, Blocks, etc.)
- Numerous Top-Level Aliases: `/language`, `/blocks`, `/data-storage`, `/device-transfer`, `/gdpr`, `/account/deletion`, `/version`, `/notification-preferences`, `/message-filters` ➡️ all map to `/settings/*`.
- `/admin/*` - Operational tooling
- `/developer` - Developer dashboard

---

## 2. Identified Overlaps, Duplication & Contradictions

### 1. Discovery vs. Study Buddy Matching
**Issue:** `/discovery` and `/study-buddy` represent two distinct matchmaking engines at the top level. Users seeking a language partner shouldn't have to guess which engine to use.
**Contradiction:** `/discovery` is for general social exchange while `/study-buddy` implies "serious learning," fragmenting the user base.

### 2. Fragmented Community, Groups, and Events
**Issue:** We have `/community`, `/groups`, `/language-parties`, `/language-islands`, and `/events`.
**Redundancy:** Groups, islands, and parties are all community-based interactions. Exposing them as separate top-level domains dilutes the "Community" concept.

### 3. Sprawling Gamification & Progress Tracking
**Issue:** A user's progress is scattered across `/stats`, `/milestones`, `/study-streak`, `/quests`, and `/leaderboard`.
**Redundancy:** These are facets of the same core user need: tracking learning progress and motivation.

### 4. Media & Live Interactions
**Issue:** `/audio-rooms`, `/classrooms`, and direct `/video-call` experiences are disjointed. Host dashboards and notes sit as siblings to major product areas.

### 5. Settings Aliases
**Issue:** Having top-level paths like `/blocks` or `/gdpr` that simply redirect to `/settings/blocks` clutters the routing table.

---

## 3. Consolidated Product Information Architecture

To resolve the fragmentation, every feature should have a clear purpose and nest logically within **5 Primary Pillars**. We will eliminate top-level alias routing in favour of absolute deep-links.

### Pillar 1: Home & Timeline (`/home`)
*Purpose: The daily habit, aggregate feed, and passive consumption.*
- `/home` - Dashboard summarizing learning and social updates.
- `/moments` - The social timeline.
- `/events` - Upcoming calendar events (merged from standalone calendar).

### Pillar 2: Explore & Community (`/explore` or `/community`)
*Purpose: Finding people, groups, and live sessions.*
- **People:** Consolidate `/discovery` and `/study-buddy` into a unified search with "Serious Learner" filters.
- **Groups:** `/community/groups` (absorbs islands, parties, and `/join`).
- **Live:** `/community/live` (absorbs `/audio-rooms`, `/classrooms`, and `/host-dashboard`).

### Pillar 3: Chat & Communication (`/chat`)
*Purpose: Private messaging, calling, and AI conversations.*
- `/chat` - Direct messaging and group chat inbox.
- `/chat/:id` - Active chat thread.
- `/chat/calls` - Consolidates `/call-logs` and active call states.
- `/chat/ai` - AI Conversation bot (`/ai-conversation`).

### Pillar 4: Learning Hub (`/learn`)
*Purpose: Active structured study and practice.*
- **Curriculum:** `/learn/lessons`, `/learn/read` (LingQ engine), `/learn/resources`.
- **Vocabulary (SRS):** `/learn/vocabulary` (absorbs `/decks`, `/review`, `/suggest-flashcards`).
- **Assessment:** `/learn/assessment` (absorbs `/diagnostic-quiz`, `/proficiency`, `/pronunciation-feedback`).

### Pillar 5: Profile & Progress (`/profile`)
*Purpose: Identity, gamification, and account management.*
- **Identity:** `/profile`, `/profile/visitors`, `/profile/business`.
- **Progress (New Unified Dashboard):** `/profile/progress` (Consolidates `/stats`, `/milestones`, `/study-streak`, `/quests`, `/leaderboard`).
- **Economy:** `/profile/store` (Consolidates `/shop`, `/sticker-store`, `/cart`, `/coin-economy`, `/vip`, `/subscription`).
- **Settings:** `/settings` (Remains the hub for preferences, removing top-level aliases like `/language`, `/blocks`, etc.).

---

## Conclusion
By shifting from a flat, organically grown routing table to a hierarchical structure based on user intent (Timeline, Find, Message, Study, Self), we provide clearer navigation paths, reduce duplicate mental models (e.g. Discovery vs Study Buddy), and present a more mature product offering.