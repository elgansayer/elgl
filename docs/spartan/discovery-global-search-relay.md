# Discovery global search Relay theme implementation

Issue: #6140 (`Spartan UI 0358`)

Target: `frontend/src/app/components/discovery/global-search`

This stage applies the Relay visual contract to the already-converted Spartan interactions from #6139. It deliberately preserves filter state, output semantics, routing, API ownership and native select behaviour.

## Visual ownership

The Global Search surface now uses only semantic Relay roles for product presentation:

- the search container uses `bg-surface-200`, `border-surface-100`, `rounded-card` and `shadow-card`;
- the logical start border uses Relay `secondary` (Tide) as the exchange-partner side of the duet without introducing a physical left/right assumption;
- native select presentation uses `rounded-app`, neutral Relay surfaces and primary focus treatment while `HlmNativeSelect` continues to own native selection behaviour;
- the audio-intro option uses the same neutral control surface and `rounded-app` role;
- Search Partners uses the Spartan primary button on the per-user `primary` token with semantic `text-on-fill`, replacing the previous celebratory `accent` colour and hardcoded white text.

No literal colour, new CSS variable or duplicate theme branch is introduced. Light and dark values therefore continue to resolve from the existing Relay token authority, including runtime primary-accent overrides.

## Responsive contract

The surface remains deliberately mobile-first and one-column so translated labels and long native language names retain usable width.

- 390px baseline: `p-4`, full-width selects and CTA, wrapping audio-intro row, minimum 44px interactive controls.
- Tablet: `sm:p-5` increases breathing room without changing the interaction order.
- Desktop: `lg:p-6` increases container spacing while preserving the same predictable vertical scan and native-control width.

The layout uses logical start-border styling and no new physical left/right utilities, so theme work does not regress RTL. The dedicated accessibility/RTL/zoom pass remains owned by #6141.

## Behaviour preserved

This PR does not change:

- the explicit filter snapshot emitted by `applyFilters()`;
- the `Any` / unchecked clear-filter contract fixed in #6139;
- language-name derivation through `Intl.DisplayNames`;
- CEFR values;
- the parent `DiscoveryComponent` search pipeline;
- authentication, network, analytics, persistence or routing behaviour.

`HlmNativeSelect`, `HlmCheckbox` and `HlmButton` remain the approved Spartan owners. No feature-local focus, keyboard or selection state machine is added.

## Verification

The existing Global Search suite continues to cover interaction behaviour. `global-search.relay.spec.ts` additionally locks:

- Relay card, surface, radius and elevation roles;
- Tide on the logical partner-side border;
- Relay input/control roles and primary focus treatment;
- primary + on-fill CTA styling with no `accent` or `text-white` fallback;
- 44px control sizing and the 390px / tablet / desktop spacing contract.

Run the focused frontend verification with:

```bash
cd frontend
npm test -- --run src/app/components/discovery/global-search/global-search.component.spec.ts src/app/components/discovery/global-search/global-search.relay.spec.ts
npm run check:relay-token-ownership
npm run check:ui-design-coverage
```

Repository CI remains authoritative for the full frontend unit, static-analysis, build, design-sync, translation-safety and E2E gates.

## Privacy and security

This is presentation-only. It introduces no new user data, storage, network request, logging, HTML sink, external asset or authorization boundary. Language/filter selections remain in component memory and follow the existing authenticated Discovery request path owned by the parent.

## Rollout and rollback

Deploy through the normal frontend release. The change is compatible with mixed frontend/backend versions because no request or response shape changes.

Rollback is a normal revert of this PR. Reverting restores the old off-token radius/elevation/accent styling but does not alter the interaction fixes from #6139.
