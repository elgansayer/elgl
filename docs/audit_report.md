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

## Proposed Migration Plan

1.  **Remove Duplicates**: We will remove individual component route definitions in `app.routes.ts` that belong to specific domains.
2.  **Spread Domain Routes**: To keep the paths at the root level (maintaining backwards compatibility and avoiding changes to router links), we will use the spread operator (`...domainRoutes`) to register these routes in `app.routes.ts`.
3.  **Preserve Legacy Links**: We will explicitly keep redirect alias rules (e.g., `path: 'visitors', redirectTo: 'profile/visitors'`) to ensure legacy navigation paths and bookmarks continue working.
