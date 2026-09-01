# Information Architecture & Route Consolidation Audit

## 1. Goal
To map every user-facing route and major capability, identify overlapping, duplicate, redundant, or contradictory features and navigation paths, and consolidate the product information architecture so every major capability has a clear purpose, entry point, and relationship to the rest of the app.

## 2. Identified Route Domains
The codebase utilizes feature-based routing modules:
- `auth.routes.ts`: Authentication, user onboarding, legal, help center.
- `media.routes.ts`: Video calls, audio rooms, host dashboard.
- `learning.routes.ts`: Vocabulary, flashcards, diagnostic quiz, study streak.
- `commerce.routes.ts`: Subscriptions, escrow, coin economy, shop.
- `social.routes.ts`: Moments, profile, discovery, leaderboard, visitors.
- `settings.routes.ts`: Privacy, data storage, notifications, account.
- `chat.routes.ts`: Group discovery, messaging.
- `admin.routes.ts`: Moderation, user management.

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
