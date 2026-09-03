# Product Information Architecture Consolidation

The product information architecture contains several redundant and overlapping paths across different route definitions.

## Redundant, Overlapping, and Contradictory Features

### Support and Help Redundancy
- **Paths**: `help, help-about`
- **Resolution**: These currently redirect to 'support'. They should be removed if 'support' is the single source of truth, or consolidated under one help center route.

### Chat Settings Duplication
- **Paths**: `chat-settings`
- **Resolution**: Redirects to 'settings/chat'. Should consolidate onto the Settings capability tree directly.

### Groups and Communities Overlap
- **Paths**: `groups/create, communities, join, join/:code, community`
- **Resolution**: 'communities' in chat routes redirects to 'community', 'groups/create' redirects to 'community/groups/create'. The entire community capability tree ('community', 'groups', 'language-parties', 'language-islands') is split between chat.routes.ts, social.routes.ts, and app.routes.ts. They should be unified under a single domain.

### Visitors Profile Overlap
- **Paths**: `visitors, profile/visitors`
- **Resolution**: 'visitors' redirects to 'profile/visitors'. 'visitors' should be removed in favor of a clean nested structure.

### Subscription / VIP Redundancy
- **Paths**: `vip, subscription, my-subscription, settings/subscription`
- **Resolution**: 'vip' redirects to 'subscription', 'my-subscription' redirects to 'settings/subscription'. Should be unified under a commerce/subscription capability.

### Settings Route Redundancy
- **Paths**: `language -> settings/language, blocks -> settings/blocks, data-storage -> settings/data-storage, device-transfer -> settings/device-transfer, gdpr -> settings/gdpr, account/deletion -> settings/account/deletion, version -> settings/version, notification-preferences -> settings/notification, settings/notification-customization -> settings/notification`
- **Resolution**: Numerous top-level routes duplicate functionality inside 'settings/'. Top-level routes like 'language', 'blocks', 'gdpr', etc., should be removed and strictly accessed via the 'settings/*' path.

## Core Capabilities and Entry Points

The product can be consolidated into the following core capabilities, each with a clear purpose and single entry point:

1. **Learning / Practice**
   - **Purpose:** Core education, language learning features, quizzes, and AI practice.
   - **Entry Point:** `/learning` (or `/study` if preferred, currently at root level for `lessons`, `quests`, `vocabulary`, `ai-conversation`).
   - **Sub-routes:** `/learning/lessons`, `/learning/vocabulary`, `/learning/quests`, `/learning/ai-conversation`.

2. **Community & Social**
   - **Purpose:** User interaction, finding partners, community events, moments feed.
   - **Entry Point:** `/community` and `/profile`.
   - **Sub-routes:** `/community/moments`, `/community/events`, `/community/groups`, `/community/language-parties`, `/profile/:userId`.

3. **Communication / Chat**
   - **Purpose:** Direct messaging, group chats, audio/video calls.
   - **Entry Point:** `/chat`.
   - **Sub-routes:** `/chat/:id`, `/chat/video-call`, `/chat/audio-rooms`.

4. **Commerce / Subscriptions**
   - **Purpose:** Managing VIP status, subscriptions, coins, and store purchases.
   - **Entry Point:** `/shop` or `/subscription`.
   - **Sub-routes:** `/shop/subscription`, `/shop/coins`, `/shop/sticker-store`.

5. **Settings & Preferences**
   - **Purpose:** User configurations, privacy, app settings, notifications.
   - **Entry Point:** `/settings`.
   - **Sub-routes:** `/settings/account`, `/settings/privacy`, `/settings/notifications`, `/settings/chat`, `/settings/language`.

6. **Administration**
   - **Purpose:** Moderation, lesson management, user management.
   - **Entry Point:** `/admin`.
   - **Sub-routes:** `/admin/moderation`, `/admin/users`, `/admin/lessons`.
