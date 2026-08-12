---
name: payment-webhook-security
description: 'Secure payment, webhook, and in-app-purchase (IAP) endpoints for Stripe, Apple App Store, and Google Play Billing. Use when adding, reviewing, or fixing any endpoint that grants VIP status, credits coins, or otherwise reacts to a payment event in the HelloTalk clone backend. Also use when auditing existing monetisation code for fraud/spoofing vulnerabilities.'
---

# Payment & Webhook Security

## Why This Skill Exists

A 2026-07-22 audit found three critical, currently-unfixed vulnerabilities in this exact codebase (see `AGENTS.md` Section 8.1):

1. `POST /monetisation/webhooks/stripe` never verifies the Stripe signature - anyone can forge a `checkout.session.completed` body and grant free VIP to any `userId`.
2. `POST /monetisation/upgrade` sets `is_vip: true` for any authenticated caller with zero payment check.
3. `POST /economy/purchase-coins` credits `coins_balance` using a client-supplied `amount` with no receipt verification - infinite free coins.

Treat every rule below as mandatory whenever you touch `backend/src/monetisation/` or `backend/src/economy/`, or add a new payment-adjacent module.

## Core Rules

1. **Never trust a client-supplied amount, tier, or balance.** Any field that changes `coins_balance`, `is_vip`, `vip_tier`, or similar must be computed server-side from a verified purchase record - never copied from `dto.amount` / `dto.tier` straight into a database write.

2. **Every inbound webhook must verify authenticity before acting on the payload:**
   - **Stripe:** use the `stripe` SDK's `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)`. This requires the raw (unparsed) request body - configure the route to skip the global JSON body parser (e.g. `@Post('webhooks/stripe')` with `express.raw({ type: 'application/json' })` middleware or a raw-body NestJS interceptor) so the signature check has the exact bytes Stripe signed.
   - **Apple App Store Server Notifications V2:** verify the signed JWS payload against Apple's root certificates before trusting `notificationType`/`data.signedTransactionInfo`.
   - **Google Play Real-time Developer Notifications:** verify the Pub/Sub message came from Google (service account / OIDC token on the push endpoint) and independently confirm the purchase via the Play Developer API `purchases.subscriptions.get` / `purchases.products.get` before trusting client-reported state.
   - Never derive trust from `metadata.userId` alone without cross-checking it against a purchase/session record you created and stored when the checkout was initiated.

3. **Client-initiated "upgrade" endpoints must not directly grant privilege.** If the frontend needs to show "upgrading..." UI, it should call an endpoint that creates a pending checkout session server-side and returns a redirect URL - the actual `is_vip`/`vip_tier` write only ever happens from the verified webhook handler, never from a client-callable endpoint.

4. **Idempotency:** webhook handlers must be safe to receive the same event twice (payment providers retry). Store the provider's event ID and skip re-processing if already seen (e.g. a `processed_webhook_events` table or a Redis `SETNX`).

5. **Logging without leaking secrets:** log the event type and outcome, never the raw signing secret or full webhook payload containing PII/payment details at `info` level.

6. **Rate limit and monitor:** coin-purchase and VIP-upgrade endpoints should be covered by the same kind of anomaly detection used elsewhere (Redis rate limiting, e.g. `daily_ai_usage:{userId}:{date}` pattern in `nlp.service.ts#checkRateLimit`) to catch abuse even if a verification bug slips through.

## Remediation Checklist for This Repo (`backend/src/monetisation`, `backend/src/economy`)

- [ ] Add `stripe` to `backend/package.json` dependencies.
- [ ] Wire raw-body parsing for `POST /monetisation/webhooks/stripe` and call `constructEvent` before touching `dto`.
- [ ] Remove or internally-gate `POST /monetisation/upgrade` so it can't unilaterally set `is_vip`.
- [ ] Rework `EconomyService#purchaseCoins` to look up a verified purchase/receipt record for the coin amount instead of trusting `dto.amount`.
- [ ] Implement Apple/Google webhook handlers with real signature verification (currently missing entirely).
- [ ] Add Vitest tests asserting: forged webhook signatures are rejected (`401`/`400`), and `upgrade`/`purchase-coins` cannot change state without a verified payment record.

## Testing Guidance

Every payment-adjacent test suite should include a specific "forged/invalid signature" test case that expects rejection, not just a "happy path" test - this is the exact class of bug the audit found (happy-path tests existed and passed while the security check was entirely absent).
