# Information Architecture (IA) Audit & Consolidation Report

## 1. Map of User-Facing Routes & Major Capabilities

### Authentication & Onboarding
- `/onboarding`: Initial user setup and preference collection.
- `/lock`: Session locking capability.
- `/forgot-password`, `/reset-password`, `/change-password`: Credential lifecycle management.
- `/terms`, `/privacy`: Core legal and compliance documentation.
- `/support`: Centralized user assistance (replaces legacy `/help` and `/help-about`).

### Social, Profile & Community
- `/discovery`: User discovery and matching based on language goals.
- `/moments`: Multimodal community timeline/feed.
- `/profile`, `/profile/:userId`: Identity, progress, and relationship management (followers/following).
- `/profile/visitors`: Log of profile interactions.
- `/leaderboard`, `/stats`, `/milestones`: Gamification and social ranking.
- `/events`, `/events/calendar`: Scheduled language events and calendar.
- `/favourites`: User's favourited content.
- `/hobby-tags`: Hobby and interest tags.
- `/notifications`: Notifications inbox.
- `/business-profile`: Business profile capability.

### Communication & Real-Time Media
- `/chat`, `/chat/:id`: Text and rich-media messaging.
- `/groups`: Directory and management for messaging groups.
- `/join`, `/join/:code`: Join group capabilities.

### Commerce & Monetization
- `/subscription`, `/subscription/success`, `/subscription/cancel`: Subscription entry for premium access (replacing `/vip`).
- `/settings/subscription`: Subscription management (replacing `/my-subscription`).

### Settings
- `/settings`: Centralized configuration hub with clear sub-domains:
  - Account (`/settings/account`), Privacy (`/settings/privacy`), Notifications (`/settings/notification`), Chat (`/settings/chat`), Language (`/settings/language`), Blocks (`/settings/blocks`), Backup (`/settings/backup-restore`), Linked Accounts (`/settings/linked-accounts`), Data Storage (`/settings/data-storage`), GDPR (`/settings/gdpr`), Version (`/settings/version`), Message Filters (`/settings/message-filters`), Appearance (`/settings/appearance`), Device Transfer (`/settings/device-transfer`), Account Deletion (`/settings/account/deletion`).

## 2. Identified Overlaps, Duplicates & Redundancies

Our audit identified significant top-level namespace clutter caused by legacy aliases and duplicate paths:
1. **Settings Fragmentation**: Numerous configuration pages leaked into the top-level namespace (`/chat-settings`, `/message-filters`, `/blocks`, `/language`, `/data-storage`, `/device-transfer`, `/gdpr`, `/version`) instead of being contained within `/settings`.
2. **Community & Group Aliasing**: Top-level redirects like `/groups/create`, `/communities`, `/language-parties`, and `/language-islands` bypassed the canonical `/community` hub.
3. **Monetization Redundancy**: `/vip` served as a duplicate entry for `/subscription`, and `/my-subscription` unnecessarily mapped to `/settings/subscription`.
4. **Support Overlaps**: `/help` and `/help-about` both redirected to `/support`.
5. **Notification Duplicates**: `/notification-customization` and `/notification-preferences` both led to `/settings/notification`.
6. **Profile Aliasing**: `/visitors` leaked out of the `/profile/visitors` hierarchy.

## 3. Consolidation Actions

To establish a clear purpose, entry point, and relationship for every major capability:
1. **Purged Legacy Redirects**: Removed all overlapping top-level `redirectTo` routes across the application (`auth.routes.ts`, `settings.routes.ts`, `social.routes.ts`, `chat.routes.ts`, `commerce.routes.ts`).
2. **Enforced Canonical Paths**: All features now strictly resolve to their architectural domain (e.g., all settings are accessed solely via `/settings/...`; all community features via `/community/...`).
