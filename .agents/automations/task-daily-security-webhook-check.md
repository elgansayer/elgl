# Daily Monetisation Webhook Security Audit

## Objective

Prevent forged Stripe, Apple, or Google payments from granting VIP access or coins.

## Instructions

1. Open the `payment-webhook-security` skill document and review recent changes in the monetisation endpoints (`backend/src/monetisation`).
2. Verify that `stripe.webhooks.constructEvent()` is rigorously used with the verified signature.
3. Ensure no unauthenticated endpoints (like `POST /monetisation/upgrade`) have crept back into the codebase.
4. Validate that transaction IDs are checked for duplication in the database.
5. Run the Vitest backend suite and assert that spoofed requests are correctly rejected with 400/403 status codes.
