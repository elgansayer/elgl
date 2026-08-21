# Frontend authentication

The Angular `AuthService` uses Supabase Auth as the only source of authenticated user and session state. Email/password sign-in, sign-up, Google OAuth and Apple OAuth all delegate to the Supabase client.

## Session lifecycle

On application startup, `AuthService` calls `supabase.auth.getSession()` and mirrors the returned session into Angular signals. It also subscribes to `onAuthStateChange` so sign-in, token refresh and sign-out events update those signals consistently.

Authentication is **fail closed**. If Supabase has no persisted session, or session restoration fails, `currentUser` and `currentSession` remain `null`, `isAuthenticated` is `false`, and initialization completes without creating a synthetic identity or token. Production code must never substitute mock users, fake JWTs or fake refresh tokens for an unauthenticated Supabase state.

The root `check:no-runtime-fallbacks` verification scans production source for known fictional runtime fallbacks, including synthetic authentication identities and tokens.

## Email and OAuth

- `signInWithEmail(email, password)` uses `signInWithPassword` and adopts the real Supabase session when present.
- `signUpWithEmail(email, password)` uses Supabase sign-up and adopts the returned session when email confirmation policy permits an immediate session.
- `signInWithGoogle()` and `signInWithApple()` use Supabase OAuth and return to the application's own origin.
- `signOut()` unregisters the FCM token first, then clears local auth state only after Supabase sign-out succeeds.

Do not persist access or refresh tokens in application-owned storage. Supabase owns its session persistence and refresh lifecycle.

## Failure and privacy behaviour

Session restoration failures are logged only as a generic warning. User credentials, access tokens and refresh tokens must not be written to logs. Badge refresh failures are non-fatal and do not create or elevate authentication state.

## Verification

Run the focused auth tests and runtime-fallback guard before merging authentication changes:

```bash
cd frontend
npx vitest run src/app/services/auth.service.spec.ts
cd ..
npm run check:no-runtime-fallbacks
```

The normal repository CI/build/test workflow remains the authoritative integration check.

## Rollout and rollback

This change does not require a database migration. Deploy frontend and static verification changes together. Users with valid Supabase sessions remain signed in; users without a valid session are correctly treated as signed out.

Rollback is a code-only deployment rollback. Do not reintroduce mock users or synthetic tokens as a rollback mechanism. If Supabase authentication is unavailable, the safe state is unauthenticated until the service recovers.
