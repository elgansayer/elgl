# Product Information Architecture & Route Mapping

## Overview

This report maps the major capabilities and user-facing routes of the HelloTalk application. It identifies the core structure, redundancy, and organization of the app's features.

## Major Capabilities

### 1. Application Core & Navigation
- `/home` (Home Dashboard)
- `/community` (Community Hub)
- `/**` -> `/ai-conversation` (Default Fallback)

### 2. Authentication & Onboarding (`auth.routes.ts`)
Handles user identity, initial setup, and account access.
- `/onboarding`
- `/forgot-password`, `/reset-password`, `/change-password`
- `/lock` (App Lock)
- `/terms`, `/privacy` (Legal)
- `/support` (Help & Support Center)

### 3. Messaging & Chat (`chat.routes.ts`)
Core communication functionality.
- `/chat` (Chat List)
- `/chat/:id` (Direct Messaging / Individual Chat)
- `/groups` (Groups Discovery)
- `/join`, `/join/:code` (Joining Groups)

### 4. Commerce & Monetisation (`commerce.routes.ts`)
Subscriptions, virtual currency, and marketplace features.
- `/subscription`, `/subscription/success`, `/subscription/cancel`
- `/settings/subscription` (My Subscription)
- `/coins/success`, `/coins/cancel`, `/coin-economy` (Virtual Coins)
- `/shop`, `/sticker-store`, `/cart` (Storefront)
- `/escrow`, `/escrow/:id` (Payments)

### 5. Learning & Language Tools (`learning.routes.ts`)
Educational features, vocabulary, flashcards, and language assessments.
- `/vocabulary`, `/decks`, `/review`, `/suggest-flashcards` (Vocabulary/Flashcards)
- `/diagnostic-quiz`, `/proficiency` (Assessments)
- `/lessons`, `/quests`, `/read` (Structured Learning)
- `/resource-library`
- `/pronunciation-feedback`
- `/study-streak`
- `/study-buddy` (Partner Matching)
- `/ai-conversation` (AI Language Practice)

### 6. Media & Audio/Video (`media.routes.ts`)
Real-time communication, calls, and streaming.
- `/audio-rooms`, `/voiceroom-notes/:roomId`, `/preview/room/:id`
- `/classrooms`
- `/video-call`, `/active-call`, `/call-logs`
- `/host-dashboard`

### 7. Social & Community (`social.routes.ts`)
User profiles, discovery, feeds, and interactions.
- `/discovery`, `/moments` (Social Feeds)
- `/profile`, `/profile/:userId` (User Profiles)
- `/profile/:userId/followers`, `/profile/:userId/following`
- `/profile/visitors`
- `/favourites`, `/hobby-tags`
- `/leaderboard`, `/stats`, `/milestones`
- `/notifications` (Inbox)
- `/events`, `/events/calendar`
- `/business-profile`

### 8. Settings & Configuration (`settings.routes.ts`)
User preferences, privacy, and account management.
- `/settings` (Main Settings Hub)
- `/settings/chat`, `/settings/account`, `/settings/appearance`, `/settings/language`
- `/settings/notification`, `/settings/message-filters`
- `/settings/privacy`, `/settings/blocks`, `/settings/gdpr`
- `/settings/backup-restore`, `/settings/linked-accounts`, `/settings/data-storage`, `/settings/device-transfer`
- `/settings/account/deletion`
- `/settings/version`

### 9. Administration (`admin.routes.ts`, `moderation.routes.ts`)
Internal tools and staff dashboards.
- `/admin`, `/admin/users`, `/admin/lessons`, `/admin/blocks`
- `/admin/moderation`, Moderation Dashboard
- `/developer`

---

## Overlapping, Duplicate, and Redundant Routes

The application contains several redundant paths that are currently handled via explicit `redirectTo` rules to preserve backward compatibility (e.g., SEO, bookmarks, deep links).

**Note:** As per architectural guidelines, these `redirectTo` entries MUST remain in the codebase to prevent breaking external links. However, for internal navigation within the app, components should link directly to the canonical destination.

### Consolidations (Aliases to Canonical Paths)

*   **Support/Help:**
    *   `/help` ➡️ `/support`
    *   `/help-about` ➡️ `/support`
*   **Chat & Community:**
    *   `/chat-settings` ➡️ `/settings/chat`
    *   `/communities` ➡️ `/community`
    *   `/groups/create` ➡️ `/community/groups/create`
    *   `/language-parties` ➡️ `/community/language-parties`
    *   `/language-islands` ➡️ `/community/language-islands`
*   **Settings & Privacy:**
    *   `/blocks` ➡️ `/settings/blocks` (Repeated in both chat and settings routes)
    *   `/message-filters` ➡️ `/settings/message-filters`
    *   `/language` ➡️ `/settings/language`
    *   `/data-storage` ➡️ `/settings/data-storage`
    *   `/device-transfer` ➡️ `/settings/device-transfer`
    *   `/gdpr` ➡️ `/settings/gdpr`
    *   `/version` ➡️ `/settings/version`
    *   `/notification-preferences` & `/settings/notification-customization` ➡️ `/settings/notification`
    *   `/account/deletion` ➡️ `/settings/account/deletion`
*   **Profiles & Commerce:**
    *   `/visitors` ➡️ `/profile/visitors`
    *   `/vip` ➡️ `/subscription`
    *   `/my-subscription` ➡️ `/settings/subscription`

## Information Architecture Recommendations

1.  **Strictly Adopt Canonical Routing Internally:** Ensure all new `<a routerLink>` or `router.navigate()` calls in the frontend use the canonical path (e.g., `/settings/language` instead of `/language`) to avoid double-routing penalties.
2.  **Centralize Settings:** Most isolated feature configurations (chat, subscriptions, blocks, privacy, storage) correctly roll up under the `/settings/*` umbrella. Maintain this pattern for future configurations.
3.  **Community Sub-Routes:** Features like groups, language parties, and islands have correctly been migrated under the `/community` umbrella path, acting as the centralized social hub, replacing root-level aliases.
