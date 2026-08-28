# Consumer VIP Benefits - API Enforcement

## Overview

The consumer VIP tier (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent)
unlocks four benefits that are enforced server-side across the NestJS API. The frontend
never grants access to these benefits: every mutation is validated against the user's
`is_vip` and `vip_tier` flags in the `users` table, and those flags are only ever changed
by verified payment webhooks (Stripe, Apple App Store, Google Play).

## Enforced Benefits

### 1. Unlimited AI usage

Free users are limited to 10 AI requests per day across translations, grammar checks,
grammar explanations, pronunciation scoring, simplification, bio translation and AI
conversation. VIP users bypass the daily cap entirely.

- `NlpService.checkRateLimit()` in `backend/src/nlp/nlp.service.ts` returns early for
  VIP users.
- `AiConversationService.checkDailyAiRateLimit()` in
  `backend/src/ai-conversation/ai-conversation.service.ts` allows VIP users through
  without touching the Redis counter.
- The per-window `NlpRateLimiterGuard` stays in place for all users as an anti-abuse
  layer alongside the global `ThrottlerGuard`.

### 2. Up to 3 target languages

Free users may study one target language; consumer VIP users may study up to three
simultaneously. Pro and developer tiers retain a five-language allowance.

- `UsersService.updateProfile()` in `backend/src/users/users.service.ts` rejects more
  than one target language for free users and more than the tier allowance for higher
  tiers.
- The `UpdateProfileDto` caps the request payload at three languages, with the tier
  check applied in the service.

### 3. Location spoofing

Setting a spoofed displayed location (coordinates, city, country) or enabling the
spoofing toggle is restricted to VIP users. Disabling the toggle stays available to
everyone.

- `UsersService.updateProfile()` rejects `mock_location`, `mock_country`, `mock_city`
  and `enable_location_spoofing: true` for non-VIP users.

### 4. Incognito profile views

VIP users can browse other profiles without appearing in the target user's "Who Viewed
Me" logs. Free users only ever see blurred visitor records on their own visitor list.

- `UsersService.updatePrivacySettings()` in `backend/src/users/users.service.ts` only
  allows `incognito_visits = true` for VIP users.
- `ProfileVisitsService.recordVisit()` in
  `backend/src/profile-visits/profile-visits.service.ts` skips the visit record when
  the VIP visitor has incognito mode enabled.
- `ProfileVisitsService.getVisitors()` returns blurred visitor identities for non-VIP
  profile owners.

## Tests

- `backend/src/users/users.service.spec.ts` covers the target language allowance,
  location spoofing gate and incognito setting gate.
- `backend/src/profile-visits/profile-visits.service.spec.ts` covers incognito visit
  recording and blurred visitor lists.
- `backend/src/nlp/nlp.service.spec.ts` and
  `backend/src/ai-conversation/ai-conversation.service.spec.ts` cover the AI usage cap
  behaviour for free and VIP users.
