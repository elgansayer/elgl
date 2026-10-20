# Information Architecture Mapping & Consolidation Audit

## Redundant/Duplicate Routes Identified:

The app currently uses a series of `redirectTo` rules to handle legacy/duplicate routes. We will consolidate the codebase to natively use the canonical routes.

### Commerce Routes (`commerce.routes.ts`)
* `vip` -> `subscription`
* `my-subscription` -> `settings/subscription`

### Social Routes (`social.routes.ts`)
* `visitors` -> `profile/visitors`
* `notification-preferences` -> `settings/notification`
* `language-parties` -> `community/language-parties`
* `language-islands` -> `community/language-islands`

### Settings Routes (`settings.routes.ts`)
* `settings/notification-customization` -> `settings/notification`
* `language` -> `settings/language`
* `blocks` -> `settings/blocks`
* `data-storage` -> `settings/data-storage`
* `device-transfer` -> `settings/device-transfer`
* `gdpr` -> `settings/gdpr`
* `account/deletion` -> `settings/account/deletion`
* `version` -> `settings/version`

### Chat Routes (`chat.routes.ts`)
* `chat-settings` -> `settings/chat`
* `groups/create` -> `community/groups/create`
* `communities` -> `community`
* `message-filters` -> `settings/message-filters`
* `blocks` -> `settings/blocks`

### Auth Routes (`auth.routes.ts`)
* `help` -> `support`
* `help-about` -> `support`
