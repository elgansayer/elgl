# Product Information Architecture Consolidation Report

## 1. Current Route Mapping & Capabilities

### Root & Navigation Base (`app.routes.ts`)
- `/` (Redirects to `/ai-conversation`)
- `/home` (General landing)
- `/community` (Community discovery)

### Authentication & Legal (`auth.routes.ts`)
- `/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`, `/lock`
- `/terms`, `/privacy`, `/support`, `/help` -> `/support`, `/help-about` -> `/support`

### Chat & Messaging (`chat.routes.ts`)
- `/chat`, `/chat/:id` (Direct messaging)
- `/groups`, `/join`, `/join/:code` (Group joining)
- Redirects: `/chat-settings`, `/groups/create`, `/communities`, `/message-filters`, `/blocks`

### Commerce & Economy (`commerce.routes.ts`)
- `/subscription`, `/subscription/success`, `/subscription/cancel`
- `/coins/success`, `/coins/cancel`, `/coin-economy`
- `/shop`, `/sticker-store`, `/cart`
- `/escrow`, `/escrow/:id` (Transactions/Tutor payments)
- Redirects: `/vip`, `/my-subscription`

### Learning & Pedagogy (`learning.routes.ts`)
- `/vocabulary`, `/decks`, `/review` (Flashcards/SRS)
- `/suggest-flashcards`, `/suggest-flashcards/:message`
- `/diagnostic-quiz`, `/proficiency` (Assessment)
- `/lessons`, `/quests`, `/read`, `/resource-library`, `/pronunciation-feedback`
- `/study-streak`, `/study-buddy`, `/ai-conversation`

### Media & Rooms (`media.routes.ts`)
- `/audio-rooms`, `/classrooms`, `/video-call`, `/active-call`, `/call-logs`
- `/voiceroom-notes/:roomId`, `/preview/room/:id`, `/host-dashboard`

### Settings (`settings.routes.ts`)
- `/settings`, `/settings/account`, `/settings/notification`, `/settings/message-filters`
- `/settings/appearance`, `/settings/language`, `/settings/privacy`, `/settings/blocks`
- `/settings/backup-restore`, `/settings/linked-accounts`, `/settings/data-storage`
- `/settings/device-transfer`, `/settings/gdpr`, `/settings/account/deletion`, `/settings/version`
- Redirects: `/language`, `/blocks`, `/data-storage`, `/device-transfer`, `/gdpr`, `/account/deletion`, `/version`

### Social & Discovery (`social.routes.ts`)
- `/discovery`, `/moments`, `/favourites`
- `/profile`, `/profile/:userId`, `/profile/:userId/followers`, `/profile/:userId/following`, `/profile/visitors`
- `/leaderboard`, `/hobby-tags`, `/stats`, `/milestones`, `/notifications`
- `/events`, `/events/calendar`, `/business-profile`
- Redirects: `/visitors`, `/notification-preferences`, `/language-parties`, `/language-islands`

---

## 2. Identified Overlaps, Redundancies, and Contradictions

1. **Duplicate Redirect Registrations**:
   - `/blocks` is redirected in both `chat.routes.ts` and `settings.routes.ts` to `settings/blocks`.
   - `/notification-preferences` is redirected to `settings/notification` in `social.routes.ts`, but `settings/notification-customization` is used in `settings.routes.ts`.

2. **Scattered Discovery & Community Entry Points**:
   - `/community`, `/groups`, `/language-islands`, `/language-parties`, `/events`, `/discovery` and `/study-buddy`. These all answer "how do I find people and content?", yet they are scattered across `social.routes.ts`, `chat.routes.ts`, and root routes.
   - `study-buddy` (serious learning partners) overlaps functionally with `discovery` (general partner finding).

3. **Gamification & Stats Fragmentation**:
   - `/stats`, `/milestones`, `/leaderboard` (in `social.routes.ts`) and `/study-streak` (in `learning.routes.ts`) represent disconnected views of user progress. They should ideally be consolidated into a unified "Progress" or "Profile Stats" view.

4. **Flashcards & Vocabulary Overlap**:
   - `/vocabulary`, `/decks`, `/review`, `/suggest-flashcards` currently exist as separate top-level route views. This fragmented SRS capability lacks a unified "Memory" hub.

5. **Assessment Redundancy**:
   - `/diagnostic-quiz` and `/proficiency` serve nearly identical logical purposes (assessing the user's level).

6. **Commerce Fragmentation**:
   - `/shop`, `/sticker-store`, `/subscription`, `/coin-economy`. The user has no unified storefront, jumping between separate top-level paths for digital goods.

---

## 3. Consolidated Product Information Architecture

To resolve the fragmented user experience, the architecture is consolidated into 5 clear primary hubs, mapping major capabilities logically with distinct entry points.

### A. The "Home & Communications" Hub (Entry: `/chat`)
**Purpose**: Primary inbox, active conversations, and immediate learning chats.
- `/chat` (Inbox)
  - `/chat/:id` (Direct Messaging & AI Conversation)
  - `/call-logs` (Recent call history)
- **AI Conversation** (`/ai-conversation`) should be an integrated contact/chat rather than a completely isolated root route.

### B. The "Social & Discovery" Hub (Entry: `/community`)
**Purpose**: Connecting with others through feeds, events, and discovery.
- `/community/feed` (replaces `/moments`)
- `/community/discovery` (replaces `/discovery` and integrates `/study-buddy` as a filter)
- `/community/groups` (incorporates `/groups` and `/join`)
- `/community/events` (incorporates `/events`, `/language-parties`)
- `/community/audio-rooms` (incorporates `/audio-rooms` and `/host-dashboard`)

### C. The "Learning & Content" Hub (Entry: `/learn`)
**Purpose**: Structured study, practice, and tools.
- `/learn/lessons` (incorporates `/lessons`, `/resource-library`)
- `/learn/read` (LingQ-style engine)
- `/learn/review` (Unified SRS: incorporates `/vocabulary`, `/decks`, `/review`)
- `/learn/assessment` (Combines `/proficiency` and `/diagnostic-quiz`)
- `/learn/classrooms` (Tutor & Escrow services)

### D. The "Profile & Progress" Hub (Entry: `/profile`)
**Purpose**: Identity, reputation, gamification, and stats.
- `/profile` (Main identity)
  - `/profile/connections` (Followers/Following/Visitors)
- `/profile/progress` (Consolidates `/stats`, `/milestones`, `/study-streak`, `/leaderboard`, `/quests`)
- `/profile/favourites` (Saved items)

### E. The "Settings & Commerce" Hub (Entry: `/settings`)
**Purpose**: Configuration, purchases, and economy.
- `/settings` (Unified settings list)
  - Account, Privacy, Language, Notifications, Chat Backup, etc.
- `/store` (Consolidates `/shop`, `/sticker-store`, `/coin-economy`, `/subscription`)
- `/support` (Help & Terms)

This consolidated structure ensures every capability has a clear ownership domain, reducing cognitive load and eliminating duplicate routing paths.
