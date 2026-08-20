# Product Information Architecture Audit

## Route Duplication and Consolidation

Currently, `app.routes.ts` defines almost all application routes flatly at the root level. Simultaneously, there are multiple domain-specific route files inside `frontend/src/app/routes/` which duplicate these same routes.

The domain-specific files found are:
- `admin.routes.ts`
- `auth.routes.ts`
- `chat.routes.ts`
- `commerce.routes.ts`
- `learning.routes.ts`
- `media.routes.ts`
- `settings.routes.ts`
- `social.routes.ts`

These domain route files are currently not being imported and used via `loadChildren` in `app.routes.ts`, leading to duplication and a lack of clear separation of concerns at the routing level.

## Redundant / Legacy Navigation Paths

The flat route structure in `app.routes.ts` contains many redirect routes (aliases) that point to their new canonical locations. These aliases are kept to preserve deep links and legacy navigation paths.

*   **Settings Namespace:**
    *   `/notification-preferences` -> `settings/notification`
    *   `/language` -> `settings/language`
    *   `/blocks` -> `settings/blocks`
    *   `/message-filters` -> `settings/message-filters`
    *   `/chat-settings` -> `settings/chat`
    *   `/data-storage` -> `settings/data-storage`
    *   `/my-subscription` -> `settings/subscription`
*   **Community Namespace:**
    *   `/groups` -> `community/groups`
    *   `/groups/create` -> `community/groups/create`
    *   `/communities` -> `community`
    *   `/language-islands` -> `community/language-islands`
    *   `/language-parties` -> `community/language-parties`
*   **Profile Namespace:**
    *   `/visitors` -> `profile/visitors`
*   **Support Namespace:**
    *   `/help-about` -> `support`

## Consolidation Strategy

Instead of maintaining the same component routes twice (once in `app.routes.ts` and once in `frontend/src/app/routes/*.ts`), we will consolidate the routing architecture to make `app.routes.ts` a composer of domain modules.

1.  **Refactor `app.routes.ts`** to remove individual component `loadComponent` entries that belong to a specific domain.
2.  **Use `loadChildren`** (or modern equivalent like `...domainRoutes` if keeping flat structure, or nested lazy loading if prefixing) to compose the domain-specific routes. Given the requirement to preserve existing paths, spreading the route arrays (`...socialRoutes`, etc.) or keeping them at the root level via `loadChildren: () => import('./routes/...').then(m => m.routes)` if they define their own full paths is the best approach.

Wait, the prompt says "consolidate the product information architecture so every major capability has a clear purpose, entry point and relationship to the rest of the app." and "A prompt directive to 'consolidate the product information architecture' constitutes an explicit instruction to modify the codebase (e.g., refactoring routing files using redirects). Do not treat it as a documentation-only mapping or audit task."

Therefore, I need to modify `app.routes.ts` to actually import and use these domain route files, removing the duplicated raw route definitions from `app.routes.ts`, while ensuring legacy redirects remain to preserve deep links!
