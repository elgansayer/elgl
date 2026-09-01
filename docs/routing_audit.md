# Information Architecture and Route Consolidation Audit

## Goal

Map the user-facing route domains, distinguish canonical entry points from compatibility aliases, and define the evidence required before any public route can be removed.

## Route domains

The Angular application aggregates feature-owned route arrays in `frontend/src/app/app.routes.ts`:

- `auth.routes.ts`: onboarding, account recovery, legal documents and support.
- `media.routes.ts`: audio rooms, classrooms, calls and host tools.
- `learning.routes.ts`: vocabulary, flashcards, assessments, lessons and AI practice.
- `commerce.routes.ts`: subscriptions, coins, shopping and escrow.
- `social.routes.ts`: discovery, moments, profiles, notifications and events.
- `settings.routes.ts`: account, notification, appearance, language, privacy and data settings.
- `chat.routes.ts`: direct chat, groups, communities and joining flows.
- `admin.routes.ts`: guarded administration, moderation and developer tools.

The root route redirects to `/ai-conversation`. `/home` and `/community` remain direct application entry points. Public legal and support routes include `/terms`, `/privacy`, `/support`, `/help` and `/help-about`.

## Canonical routes and compatibility aliases

The following aliases deliberately preserve bookmarks, external links, notification payloads and older clients:

| Compatibility route | Canonical route |
| --- | --- |
| `/help`, `/help-about` | `/support` |
| `/vip` | `/subscription` |
| `/my-subscription` | `/settings/subscription` |
| `/visitors` | `/profile/visitors` |
| `/notification-preferences` | `/settings/notification` |
| `/language` | `/settings/language` |
| `/blocks` | `/settings/blocks` |
| `/data-storage` | `/settings/data-storage` |
| `/device-transfer` | `/settings/device-transfer` |
| `/gdpr` | `/settings/gdpr` |
| `/account/deletion` | `/settings/account/deletion` |
| `/version` | `/settings/version` |
| `/settings/notification-customization` | `/settings/notification` |
| `/chat-settings` | `/settings/chat` |
| `/communities` | `/community` |
| `/message-filters` | `/settings/message-filters` |

The valid compatibility routes add intentional breadth to the route table, not competing implementations. First-party links may move to canonical routes while aliases remain available.

## Unresolved route defects

Three compatibility routes currently redirect to destinations that are not registered anywhere in the Angular route tree:

| Compatibility route | Unregistered target |
| --- | --- |
| `/groups/create` | `/community/groups/create` |
| `/language-parties` | `/community/language-parties` |
| `/language-islands` | `/community/language-islands` |

Until explicit child or top-level routes exist, these redirects must not be described as canonical mappings. Add focused deep-link tests and either register the intended destinations or retarget the aliases to valid routes.

`/blocks` is also declared in both `settings.routes.ts` and `chat.routes.ts`. Both definitions point to `/settings/blocks`, so behaviour is consistent, but ownership should be consolidated into one feature route array without removing the public alias.

## Removal boundary

A compatibility route may be removed only after all of the following are complete:

1. Confirm current first-party links, notification payloads, email links and documented URLs use the canonical route.
2. Define a minimum supported client version or equivalent compatibility window.
3. Measure legacy-route traffic for that window and document the result.
4. Add focused tests for both the legacy deep link and the canonical destination, including SSR or server rewrite behaviour where relevant.
5. Provide a deployed redirect before removing the Angular alias when external entry points could still target it.
6. Record the migration and removal date in this document.

Until that evidence exists, compatibility redirects must remain in the client route tree.
