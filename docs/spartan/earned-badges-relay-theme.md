# Earned badges Relay theme completion

Issue: #6160 (`Spartan UI 0378`)

Target: `frontend/src/app/components/earned-badges`

## What changed

`EarnedBadgesComponent` now delegates badge geometry, typography and semantic fill ownership to the existing `AppPillComponent` Relay primitive instead of rebuilding pills with feature-local Tailwind recipes.

The previous gradients mixed unrelated semantic roles:

- VIP: `vip -> accent`
- Serious Learner: `secondary -> success`

The completed contract is deliberately simpler:

- **VIP** uses the canonical `vip` gold fill with `on-fill` text.
- **Serious Learner** uses `primary` with `on-fill` text because it represents the current learner's own earned status. `primary` remains per-user accent aware.

`AppPillComponent` now exposes `vip` as a typed colour variant. This keeps the approved VIP gold treatment owned by Relay instead of passing feature-specific Tailwind strings through `customClass`.

## Responsive and theme contract

The badge group remains mobile-first and wrapping. Both the group and each pill now explicitly allow shrinking to the available inline width, and pill labels use normal whitespace plus word breaking so long translations cannot force horizontal overflow in narrow hosts.

The production surface contains no fixed width or breakpoint-specific product styling. The same semantic token names resolve through Relay in light and dark themes, including `on-fill`, which intentionally changes from paper text in light mode to ink text in dark mode.

The component introduces no hard-coded colour values, shadows or off-token radii. Pill geometry uses `rounded-pill`, and spacing remains logical (`ps`, `pe`, `me`) for direction independence.

## Behaviour deliberately unchanged

- VIP renders before Serious Learner when both statuses are earned.
- `badges.none` remains the empty/unavailable copy.
- `vipTier` remains data-only and is not exposed by this component.
- Badge state continues to come exclusively from `AuthService.earnedBadges()`.
- The surface remains read-only with no route, mutation, analytics or focusable interaction.
- No new loading/error semantics are inferred from the existing nullable badge signal.

The badge emoji are marked decorative because the translated visible labels already carry the complete status meaning. This prevents the new pill composition from creating duplicate spoken content without changing the component's interaction model.

## Verification

Focused Angular coverage now locks:

- VIP-only, Serious-Learner-only, combined and empty states;
- Relay `vip`, `primary`, `on-fill` and `rounded-pill` ownership;
- removal of the old feature-owned gradients;
- bounded/wrap-safe group and pill layout;
- decorative emoji treatment;
- preservation of the non-interactive contract;
- the reusable pill's new typed VIP colour role and wrap-safe layout.

Repository CI remains the authoritative clean-environment verification for frontend tests, build/static analysis, Relay/Spartan governance and design coverage.

## Rollout and rollback

This is a frontend-only presentation change. It requires no schema, API, storage or coordinated backend deployment.

Roll back with a normal revert. Existing badge data and entitlement behavior are unaffected because the change does not alter `AuthService`, Supabase queries or persisted profile fields.
