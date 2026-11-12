# Deep linking

The Angular client accepts `hellotalk://` deep links and maps them to internal routes. The mapping
lives in `frontend/src/app/services/deep-link.service.ts` and is wired into bootstrap by
`initialiseDeepLinks` in `frontend/src/app/app.config.ts`.

## Supported links

| Deep link | Internal route |
| --- | --- |
| `hellotalk://profile/:id` | `/profile/:userId` |
| `hellotalk://chat/:id` | `/chat/:id` |
| `hellotalk://events[/:id]` | `/events[/:id]` |
| `hellotalk://moments`, `discovery`, `settings`, `home`, `vip`, `study-buddy`, `lessons`, `vocabulary`, `leaderboard`, `favourites`, `help` | Matching internal routes; `vip` maps to `/subscription` and `help` to `/support` |

The service also defines legacy mappings for `groups` and `audio-rooms`; their detail routes must be
registered before those links are advertised. Unknown hosts return `false`.

Query parameters are preserved on the internal route. URL fragments are not forwarded.

## Bootstrap and runtime handling

- The application initializer processes the launch URL and any legacy Android `IntentURI`.
- The same initializer registers runtime listeners for Capacitor/Cordova `appUrlOpen` and
  `deepLink` events so links received while the app is already open are routed.
- Browser protocol-handler registration for `web+hellotalk` is best-effort and never blocks
  bootstrap.

## Input validation

Deep links are untrusted input. The parser:

- rejects malformed percent-encoding instead of throwing;
- strips fragments and keeps only the first query string;
- rejects path traversal (`..`), multi-segment ids, embedded `/` or `\`, and control characters;
- only navigates to hosts in the allowlist above.

Unknown hosts and unsafe ids return `false` and leave the current route unchanged.

## SSR and hydration

`initialiseDeepLinks` reads the browser through injected `DOCUMENT` and its optional
`defaultView`. On the server `defaultView` is absent, so no deep-link work or listener
registration runs. Runtime listener registration also guards against a missing `window`.

## Verification

Focused coverage lives in
`frontend/src/app/services/deep-link.service.spec.ts` and
`frontend/src/app/app.config.spec.ts`. It covers profile deep links, trailing slashes, missing
ids, unknown hosts, query preservation, malformed encoding, path traversal, fragments, runtime
listener registration, protocol-handler failure handling and the server/no-view path.

## Rollback

Revert the initializer wiring and the parser validation changes together. No persisted data or
database migration is involved, so rollback is limited to the frontend deployment.
