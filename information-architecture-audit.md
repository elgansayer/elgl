# Information Architecture Audit

## Core Capabilities & Entry Points
1. **Auth & Onboarding:** `/onboarding`, `/forgot-password`, `/reset-password`, `/change-password`, `/lock`. (Entry: app launch/auth required).
2. **Media/Classrooms:** `/audio-rooms`, `/classrooms`, `/video-call`, `/call-logs`. (Entry: discovery, chat).
3. **Learning/Tools:** `/vocabulary`, `/decks`, `/review`, `/diagnostic-quiz`, `/proficiency`, `/lessons`, `/quests`, `/ai-conversation`. (Entry: main nav, profile).
4. **Commerce:** `/subscription`, `/coin-economy`, `/shop`, `/sticker-store`, `/cart`, `/escrow`. (Entry: settings, chat features).
5. **Social/Discovery:** `/discovery`, `/moments`, `/profile`, `/leaderboard`, `/events`. (Entry: main nav tabs).
6. **Chat/Communication:** `/chat`, `/chat/:id`, `/groups`, `/join`. (Entry: main nav default).
7. **Settings/Config:** `/settings`, `/settings/account`, `/settings/privacy`, `/settings/notification`, `/settings/appearance`. (Entry: profile -> settings).
8. **Admin/Moderation:** `/admin`, `/admin/moderation`, `/admin/blocks`. (Entry: privileged).

## Overlaps, Duplicates, and Redundancies
The audit revealed numerous "legacy" or duplicate paths that simply redirect to a canonical modern path. These add unnecessary routing tree depth and confusion.

- **Auth:** `/help`, `/help-about` duplicate `/support`.
- **Commerce:** `/vip` duplicates `/subscription`; `/my-subscription` duplicates `/settings/subscription`.
- **Social:** `/visitors` duplicates `/profile/visitors`; `/notification-preferences` duplicates `/settings/notification`; `/language-parties` and `/language-islands` duplicate `community/...`.
- **Settings:** Legacy root paths (`/language`, `/blocks`, `/data-storage`, `/device-transfer`, `/gdpr`, `/account/deletion`, `/version`) duplicate their nested counterparts under `/settings/...`. `/settings/notification-customization` duplicates `/settings/notification`.
- **Chat:** `/chat-settings`, `/groups/create`, `/communities`, `/message-filters`, `/blocks` are redundant root-level aliases for canonical paths under `/settings` or `/community`.

## Consolidation Strategy
Due to the PR review, these routes will not be removed right now. They need to be preserved for compatibility with bookmarks, search results, notifications, and older clients. We need to implement a staged deprecation or migration boundary with server-side redirects and focused deep-link compatibility tests before removing the client side paths.
