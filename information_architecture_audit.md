# Information Architecture & Route Consolidation Audit

## 1. Goal
To map every user-facing route and major capability, identify overlapping, duplicate, redundant, or contradictory features and navigation paths, and consolidate the product information architecture so every major capability has a clear purpose, entry point, and relationship to the app.

## 2. Identified Route Domains
The application uses feature-based routing modules, aggregating routes into `frontend/src/app/app.routes.ts`:
- `auth.routes.ts`: Authentication, user onboarding, legal documents (`terms`, `privacy`), and support (`support`).
- `media.routes.ts`: Video calls (`video-call`), audio rooms (`audio-rooms`), classrooms, and live broadcasting dashboards.
- `learning.routes.ts`: Vocabulary tracking, flashcards (`decks`, `review`), diagnostic quizzes, and AI tools (`ai-conversation`).
- `commerce.routes.ts`: Subscriptions (`subscription`), coin economy (`coin-economy`), escrow (`escrow`), and virtual shop (`shop`).
- `social.routes.ts`: Discovery (`discovery`), moments feed (`moments`), profiles (`profile`), leaderboards (`leaderboard`), and events (`events`).
- `settings.routes.ts`: App preferences (`settings`), privacy (`settings/privacy`), account management (`settings/account`), and notifications (`settings/notification`).
- `chat.routes.ts`: Core messaging (`chat`), group discovery (`groups`), and chat room settings.
- `admin.routes.ts`: Moderation tools (`admin/moderation`), block management (`admin/blocks`), and user administration (`admin/users`).

## 3. Findings: Duplications & Redundancies
The current architecture delegates component loading to the feature modules (`...authRoutes`, etc.). However, several legacy, top-level routes persist as redirects to domain-specific paths, creating overlapping aliases:

- `/vip` redirects to `subscription` (`commerce.routes.ts`).
- `/my-subscription` redirects to `settings/subscription` (`commerce.routes.ts`).
- `/chat-settings` redirects to `settings/chat` (`chat.routes.ts`).
- `/groups/create` redirects to `community/groups/create` (`chat.routes.ts`).
- `/communities` redirects to `community` (`chat.routes.ts`).
- `/message-filters` redirects to `settings/message-filters` (`chat.routes.ts`).
- `/blocks` redirects to `settings/blocks` (`chat.routes.ts` & `settings.routes.ts`).
- `/settings/notification-customization` redirects to `settings/notification` (`settings.routes.ts`).
- `/language` redirects to `settings/language` (`settings.routes.ts`).
- `/data-storage` redirects to `settings/data-storage` (`settings.routes.ts`).
- `/device-transfer` redirects to `settings/device-transfer` (`settings.routes.ts`).
- `/gdpr` redirects to `settings/gdpr` (`settings.routes.ts`).
- `/account/deletion` redirects to `settings/account/deletion` (`settings.routes.ts`).
- `/version` redirects to `settings/version` (`settings.routes.ts`).
- `/visitors` redirects to `profile/visitors` (`social.routes.ts`).
- `/notification-preferences` redirects to `settings/notification` (`social.routes.ts`).
- `/language-parties` redirects to `community/language-parties` (`social.routes.ts`).
- `/language-islands` redirects to `community/language-islands` (`social.routes.ts`).
- `/help` and `/help-about` redirect to `support` (`auth.routes.ts`).

Some redundancies cross domains, such as `/blocks` being defined in both `chat.routes.ts` and `settings.routes.ts` as a redirect to `settings/blocks`.

## 4. Proposed Consolidation Strategy
1. **Remove Duplicate Definitions**: Eliminate the overlapping alias definitions (e.g., `/blocks` in `chat.routes.ts` should be removed since it belongs to `settings.routes.ts`).
2. **Canonical Mapping**: Maintain legacy unstructured routes only where they serve as critical deep links or historical SEO paths. Otherwise, phase them out in favor of structured hierarchical routes (e.g., all settings under `/settings/`).
3. **Core Entry Alignment**: Ensure the default entry point (`/ai-conversation` in `app.routes.ts`) aligns with the user's primary intent, consolidating the standalone `/home` and `/community` feeds if their purposes overlap.
