# Information Architecture & Route Consolidation Audit

## 1. Goal
To map every user-facing route and major capability, identify overlapping, duplicate, redundant, or contradictory features and navigation paths, and consolidate the product information architecture so every major capability has a clear purpose, entry point, and relationship to the rest of the app.

## 2. Identified Route Domains
The codebase utilizes feature-based routing modules:
- `auth.routes.ts`: `/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`, `/lock`, `/terms`, `/privacy`, `/help`, `/support`, `/help-about`.
- `media.routes.ts`: `/audio-rooms`, `/classrooms`, `/video-call`, `/call-logs`, `/active-call`, `/voiceroom-notes/:roomId`, `/preview/room/:id`, `/host-dashboard`.
- `learning.routes.ts`: `/vocabulary`, `/decks`, `/review`, `/suggest-flashcards`, `/suggest-flashcards/:message`, `/diagnostic-quiz`, `/proficiency`, `/lessons`, `/quests`, `/read`, `/resource-library`, `/pronunciation-feedback`, `/study-streak`, `/study-buddy`, `/ai-conversation`.
- `commerce.routes.ts`: `/vip` (redirects to `/subscription`), `/subscription`, `/subscription/success`, `/subscription/cancel`, `/my-subscription` (redirects to `/settings/subscription`), `/settings/subscription`, `/coins/success`, `/coins/cancel`, `/coin-economy`, `/shop`, `/sticker-store`, `/cart`, `/escrow`, `/escrow/:id`.
- `social.routes.ts`: `/discovery`, `/moments`, `/profile`, `/profile/:userId`, `/profile/:userId/followers`, `/profile/:userId/following`, `/visitors` (redirects to `/profile/visitors`), `/profile/visitors`, `/favourites`, `/leaderboard`, `/hobby-tags`, `/stats`, `/milestones`, `/notifications`, `/notification-preferences` (redirects to `/settings/notification`), `/events`, `/events/calendar`, `/language-parties` (redirects to `/community/language-parties`), `/language-islands` (redirects to `/community/language-islands`), `/business-profile`.
- `settings.routes.ts`: `/settings/chat`, `/settings`, `/settings/account`, `/settings/notification`, `/settings/notification-customization` (redirects to `/settings/notification`), `/settings/message-filters`, `/settings/appearance`, `/language` (redirects to `/settings/language`), `/settings/language`, `/settings/privacy`, `/blocks` (redirects to `/settings/blocks`), `/settings/blocks`, `/settings/backup-restore`, `/settings/linked-accounts`, `/data-storage` (redirects to `/settings/data-storage`), `/settings/data-storage`, `/device-transfer` (redirects to `/settings/device-transfer`), `/settings/device-transfer`, `/gdpr` (redirects to `/settings/gdpr`), `/settings/gdpr`, `/account/deletion` (redirects to `/settings/account/deletion`), `/settings/account/deletion`, `/version` (redirects to `/settings/version`), `/settings/version`.
- `chat.routes.ts`: `/chat`, `/chat/:id`, `/chat-settings` (redirects to `/settings/chat`), `/groups`, `/groups/create` (redirects to `/community/groups/create`), `/communities` (redirects to `/community`), `/join`, `/join/:code`, `/message-filters` (redirects to `/settings/message-filters`), `/blocks` (redirects to `/settings/blocks`).
- `admin.routes.ts`: `/admin`, `/admin/lessons`, `/admin/moderation`, `/admin/blocks`, `/admin/users`, `/developer`.

## 3. Findings: Duplications & Redundancies
The audit revealed that `frontend/src/app/app.routes.ts` contained numerous duplicated route definitions that were already accurately managed in the domain-specific modules. This redundant architectural setup led to disconnected and hard-to-maintain navigation paths.

Notable legacy top-level routes that overlapped with domain capabilities include:
- `vip` overlapping with `commerce.routes.ts`
- `notification-preferences` overlapping with `settings.routes.ts`
- `groups` overlapping with `chat.routes.ts`
- `visitors` overlapping with `social.routes.ts`

## 4. Consolidation & Refactoring Strategy
1. **Delegation**: Instead of hard-coding every component load directly in `app.routes.ts`, we transitioned the application to aggregate paths directly from the feature domains using JavaScript spreads (`...authRoutes`, `...mediaRoutes`, etc.).
2. **Canonical Mapping**: Legacy unstructured routes (e.g., `/vip`, `/groups`, `/visitors`, `/language`, `/message-filters`) have been retained exclusively as redirects pointing to their new canonical structural homes within their respective domains (e.g., `redirectTo: 'settings/language'`, `redirectTo: 'subscription'`).
3. **Core Entry**: The root path (`/`) correctly redirects to `/ai-conversation`, providing a definitive core entry point, while unstructured global paths like `home` and `community` remain accessible.
