# Information Architecture Consolidation Report

This report outlines the redundant routing paths that were mapped and consolidated in the codebase to simplify the application's information architecture. The old 'redirectTo' paths were analyzed, and their occurrences in UI components and router navigation were refactored to point to their new canonical paths.

## Mapped Redundant Routes

| Legacy Path (redirectTo) | Canonical Entry Point |
| :--- | :--- |
| `/account/deletion` | `/settings/account/deletion` |
| `/blocks` | `/settings/blocks` |
| `/chat-settings` | `/settings/chat` |
| `/communities` | `/community` |
| `/data-storage` | `/settings/data-storage` |
| `/device-transfer` | `/settings/device-transfer` |
| `/gdpr` | `/settings/gdpr` |
| `/groups/create` | `/community/groups/create` |
| `/help` | `/support` |
| `/help-about` | `/support` |
| `/language` | `/settings/language` |
| `/language-islands` | `/community/language-islands` |
| `/language-parties` | `/community/language-parties` |
| `/message-filters` | `/settings/message-filters` |
| `/my-subscription` | `/settings/subscription` |
| `/notification-preferences` | `/settings/notification` |
| `/settings/notification-customization` | `/settings/notification` |
| `/version` | `/settings/version` |
| `/vip` | `/subscription` |
| `/visitors` | `/profile/visitors` |
