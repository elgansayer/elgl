# Web Vitals image-loading audit

Issue: #1770

## Scope

This audit focuses on image-loading behavior that can affect Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and main-thread/network contention in the Angular application. It intentionally does not apply `loading="lazy"` to every image: an above-the-fold/LCP image must remain eligible for eager loading, while repeated list imagery that is not required for the initial paint should be deferred.

## Findings

Repository code search shows that image loading is already mixed by intent. Discovery profile cards use lazy loading, while two repeated avatar lists still requested every avatar immediately:

- `UserSpotlightComponent` renders a collection of recently joined users.
- `LeaderboardComponent` renders up to 20 corrector avatars.

These are bounded list images rather than route-level hero/LCP assets. They are safe candidates for browser-native lazy loading. Both surfaces also had CSS dimensions but no intrinsic HTML dimensions, so the browser had less information available before styles and image metadata were resolved.

Other image surfaces should be assessed by visibility and LCP candidacy before changing their loading priority. In particular, do not blindly lazy-load a route's primary hero/profile image or an image that is expected to be visible in the initial viewport.

## Contract

For bounded, repeated list avatars that are not LCP candidates:

- use `loading="lazy"` so offscreen requests are deferred;
- use `decoding="async"` so decoding does not unnecessarily block presentation;
- provide intrinsic `width` and `height` matching the base rendered aspect ratio to reserve layout space;
- retain meaningful `alt` text when the image conveys identity, and empty `alt` when the adjacent text already provides the identity.

For likely LCP images, keep eager/default loading unless measurement shows otherwise. Prefer explicit dimensions even when loading eagerly.

## Changes in #1770

- User Spotlight avatars now use lazy loading, async decoding, and 40x40 intrinsic dimensions.
- Leaderboard avatars now use lazy loading, async decoding, and 40x40 intrinsic dimensions.
- User Spotlight regression coverage locks the loading and dimension contract.

No API, database, authentication, analytics, or persisted-state behavior changes.

## Verification

Relevant checks:

```bash
cd frontend
npm test -- --run src/app/components/user-spotlight.component.spec.ts
npm run lint:check
npm run build
```

Repository CI remains authoritative for the complete Angular unit/static-analysis/build and governance suites.

## Rollout and rollback

This is a browser-rendering optimization with no data migration. Roll out as a normal frontend release. If a deferred avatar is shown to be a genuine LCP regression on a measured route, revert lazy loading for that specific LCP candidate rather than removing the policy from repeated list images globally.
