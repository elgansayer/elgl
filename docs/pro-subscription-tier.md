# Pro subscription tier

## Scope

The Pro plan is the paid learner tier identified publicly as `pro_12_ukp_15_usd` and persisted internally as the canonical `vip_tier` value `pro` while `is_vip = true`.

The plan catalogue exposes the intended learner benefits: unlimited translations, advanced profile-visitor insight, nearby-member visibility and an ad-free experience. Existing Consumer VIP behaviour is preserved. Pro is an additive tier and this change does not revoke benefits from existing paid users.

## Canonical entitlement mapping

Payment providers use different product identifiers. Authorization and product code must not branch on those provider-specific strings. `SubscriptionPlansService.getTierByProductId()` therefore resolves all supported identifiers to one of three stable values:

- `consumer`
- `pro`
- `developer`

The mapping accepts internal plan IDs, Apple product IDs, catalogue Stripe identifiers and the Stripe price IDs configured at runtime through `STRIPE_*_PRICE_ID` variables. This is particularly important for restore-purchase and webhook paths, which receive provider product or price IDs rather than the internal plan ID.

Before this contract was enforced, Stripe checkout stored `pro` while Apple, Google Play and some restore paths could persist `pro_12_ukp_15_usd`. That mixed representation made downstream entitlement checks and the subscription UI provider-dependent.

## Pro benefits

### Unlimited translations

Pro is an active VIP tier, so it follows the existing server-side unlimited AI/translation entitlement. Per-window anti-abuse throttling remains in place even when the daily free-user allowance is bypassed.

### Advanced visitor logs

Pro remains inside the authenticated VIP visitor-log boundary. Existing privacy controls, block filtering and incognito behaviour continue to apply. A paid entitlement never bypasses another user's privacy settings.

### Nearby members visibility

Pro participates in the existing VIP discovery behaviour and location controls. Location data remains subject to the existing privacy, block and distance-rounding rules. No new precise-location exposure is introduced by this tier mapping.

### Ad-free experience

The current product has no active advertising delivery surface. Pro nevertheless keeps the ad-free product promise in the plan contract. Any future advertising surface must consult the authoritative subscription entitlement before rendering ads rather than inferring status from client state.

## Security and privacy

`is_vip` and `vip_tier` remain server-authoritative and are changed only by verified payment/webhook or purchase-restoration paths. Client-supplied plan labels do not grant paid capabilities. Unknown product IDs resolve to no tier and must not grant an entitlement.

The configured Stripe price IDs are read from server configuration only. They are compared in memory and are not logged or returned by the entitlement mapping.

## Failure behaviour

Unknown or stale provider product IDs return `null`. Callers therefore do not activate or restore a subscription unless the product can be mapped to a known tier. Provider outages retain their existing fail-closed behaviour.

## Verification

`backend/src/monetisation/services/subscription-plans.service.spec.ts` verifies:

- the Pro catalogue contains the four core product benefits;
- internal, Apple, catalogue Stripe and runtime-configured Stripe product IDs resolve to canonical tiers;
- Consumer, Pro and Developer mappings remain distinct;
- free and unknown products do not grant paid entitlement.

The existing Apple, Google Play, Stripe and restore-purchase code paths all consume `getTierByProductId()`, so the canonical result is shared across acquisition and restoration flows.

## Rollout and rollback

No database migration is required. Deploying the backend is sufficient for new webhook and restore operations to persist canonical tier values.

Existing rows containing legacy long-form tier IDs remain accepted by current prefix-based checks. They can be normalized opportunistically by the next verified subscription event or restore operation, avoiding a risky bulk entitlement rewrite.

Rollback is a normal application revert. No persisted schema or irreversible state is introduced.
