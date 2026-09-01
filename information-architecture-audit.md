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

## Overlaps, Duplicates, and Redirect Defects
The route table contains legacy aliases intended to redirect to canonical paths. Some work as compatibility boundaries, while others are currently shadowed or target routes that are not registered.

- **Auth:** `/help` and `/help-about` redirect to `/support`.
- **Commerce:** `/vip` redirects to `/subscription`; `/my-subscription` redirects to `/settings/subscription`.
- **Social:** `/notification-preferences` redirects to `/settings/notification`. `/visitors` redirects to `/profile/visitors`, but the earlier `/profile/:userId` route shadows that destination. `/language-parties` and `/language-islands` redirect to unregistered `/community/language-*` destinations.
- **Settings:** Legacy root paths (`/language`, `/blocks`, `/data-storage`, `/device-transfer`, `/gdpr`, `/account/deletion`, `/version`) redirect to nested settings paths. The Settings declaration of `/blocks` appears first and is the effective compatibility alias. `/settings/notification-customization` redirects to `/settings/notification`.
- **Chat:** `/chat-settings`, `/communities`, and `/message-filters` are root-level compatibility aliases. Chat declares `/blocks` again, but that later declaration is unreachable because the Settings alias already matches it. `/groups/create` redirects to the unregistered `/community/groups/create` destination.
- **Custom-scheme deep links:** `hellotalk://groups/<id>`, `hellotalk://events/<id>`, and `hellotalk://audio-rooms/<id>` emit `/groups/:id`, `/events/:id`, and `/audio-rooms/:id`. None of those parameterized Angular routes is registered.
- **Other route producers:** Calendar and reminder flows also emit `/events/:id`; Discovery and Moments emit `/profile/user/:id` instead of the registered `/profile/:userId`; direct-message flows emit `/chat/room/:channel` instead of `/chat/:id`. These paths all fall through to the wildcard redirect.

## Consolidation Strategy
Do not remove compatibility routes until bookmarks, search results, notifications, and older clients have a migration boundary. First repair the shadowed and unregistered redirect destinations above and lock them with focused deep-link tests. Any later removal requires staged deprecation, server-side redirects, and evidence that supported clients no longer depend on the aliases.
