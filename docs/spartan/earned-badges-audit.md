# Earned badges Spartan/Relay audit

Issue: #6158 (`Spartan UI 0376`)

Target: `frontend/src/app/components/earned-badges`

Status: implementation baseline for #6159-#6162.

## Purpose

This audit records the current `EarnedBadgesComponent` contract before the Spartan UI + Relay migration stages. It inventories every rendered state and presentation element, identifies the correct ownership layer, and records data, accessibility, internationalisation, theme, RTL, responsive, and regression risks that must not be lost during conversion.

The component is a **read-only status surface**. It contains no user-operated control, overlay, focus state machine, navigation, analytics hook, or mutation. The migration must therefore not add Spartan Brain merely to increase framework usage.

## Files inspected

- `frontend/src/app/components/earned-badges/earned-badges.component.ts`
- `frontend/src/app/components/earned-badges/earned-badges.component.spec.ts`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/services/supabase.service.ts`
- `frontend/src/app/components/primitives/pill/pill.component.ts`
- `frontend/src/app/components/primitives/chip/chip.component.ts`
- `docs/spartan-relay-architecture.md`
- #6159 - control/interaction conversion
- #6160 - Relay tokens/responsive/theme parity
- #6161 - accessibility/RTL/zoom/input-method pass
- #6162 - regression/design-preview completion

## Current component contract

`EarnedBadgesComponent` injects `AuthService` and exposes a computed view of `AuthService.earnedBadges()`.

`AuthService.earnedBadges` is a signal with this effective shape:

```ts
{
  isVip: boolean;
  vipTier: string;
  isSeriousLearner: boolean;
} | null
```

`AuthService` refreshes the signal after session discovery and on authenticated auth-state changes by calling `SupabaseService.getEarnedBadges(userId)`. A successful refresh also mirrors the status onto `currentUser` as `is_vip`, `vip_tier`, and `is_serious_learner`.

`SupabaseService.getEarnedBadges()` reads `is_vip`, `vip_tier`, and `is_serious_learner` from the `users` table. On a query error it currently logs a warning and returns the same values as an ordinary user with no earned status:

```ts
{
  isVip: false,
  vipTier: 'free',
  isSeriousLearner: false,
}
```

That error collapsing is part of the current upstream behaviour and must not be accidentally redefined by a presentation migration.

## State inventory

| State                             | Current trigger                                    | Current rendering                                | Intended migration ownership                                                      |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Initial / unavailable badge state | `earnedBadges() === null`                          | `badges.none`                                    | Feature/data state; presentational empty state in Relay                           |
| No earned statuses                | `isVip === false` and `isSeriousLearner === false` | `badges.none`                                    | Feature state; Relay presentation                                                 |
| VIP only                          | `isVip === true`                                   | Crown + translated VIP pill                      | Relay static badge/pill presentation                                              |
| Serious Learner only              | `isSeriousLearner === true`                        | Graduation-cap + translated Serious Learner pill | Relay static badge/pill presentation                                              |
| VIP + Serious Learner             | both flags true                                    | Two wrapping pills                               | Relay static badge-group presentation                                             |
| VIP tier present                  | `vipTier` loaded by `AuthService`                  | Not rendered                                     | Feature data only; preserve as non-visual data unless product requirements change |
| Upstream query error              | `getEarnedBadges()` query fails                    | Indistinguishable from no badges                 | Data/service concern; do not invent UI semantics in #6159                         |
| Unexpected refresh rejection      | `refreshEarnedBadges()` catches                    | signal becomes `null`, therefore `badges.none`   | Data/service concern; currently indistinguishable from empty                      |

### Important state ambiguity

The component cannot distinguish **loading/unavailable**, **upstream failure**, and **successfully loaded with no badges**. Optional chaining causes a `null` signal to fall through to the same `badges.none` branch as a real empty result.

This is not a Spartan interaction problem. If product design wants loading or error feedback, the data contract must first expose an explicit status such as `loading | ready | error`. Do not infer an error from the current `null` value in #6159 because `null` is also used during normal startup/session transitions.

## Control and interaction inventory

There are **no interactive elements** in this component today.

Specifically, there are no:

- buttons;
- anchors or router links;
- form controls;
- selectable chips;
- menus, popovers, tooltips, dialogs, sheets, or overlays;
- keyboard handlers;
- pointer/touch handlers;
- disabled or busy controls;
- focus-management hooks.

The two badge elements and the empty message are ordinary `<span>` elements. The outer wrapper is a non-interactive `<div>`.

### Consequence for #6159

#6159 must not turn the badges into buttons, selectable chips, or another interactive Spartan primitive. There is no interaction state machine to migrate. A no-op interaction migration, or a presentation-only convergence to the correct Relay primitive, is preferable to introducing false affordances.

## Behaviour, route, analytics, and side-effect contracts

### Product behaviour

The current rendering rules are:

1. render VIP when `isVip` is true;
2. render Serious Learner when `isSeriousLearner` is true;
3. render both when both are true;
4. render the translated `badges.none` copy only when neither flag is true.

Badge ordering is stable: VIP first, Serious Learner second.

### Navigation

There is no navigation contract in `EarnedBadgesComponent`.

The component does not inject `Router`, does not declare `routerLink`, and does not emit navigation events. Migration must not add badge-click navigation unless a separate product ticket explicitly defines it.

### Analytics

There are no analytics hooks in this component.

Do not add impression or click events as part of the Spartan migration. If badge analytics are required later, they should be a separate product/telemetry change with defined event ownership.

### Mutations

There are no mutations in this component. Badge acquisition and persistence happen outside the component.

The component must remain a pure presentation consumer of authenticated user status during this migration series.

## Spartan / Relay ownership map

The authoritative architecture says static chips, pills, and badges stay in Relay unless interactive semantics require Brain. That rule applies directly here.

| Current element/capability | Current implementation | Target owner                             | Migration guidance                                                                        |
| -------------------------- | ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Badge group                | `div.flex.flex-wrap`   | Feature composition + Relay presentation | Keep wrapping layout feature-owned unless a reusable badge-group primitive already exists |
| VIP status badge           | styled `<span>`        | Relay static pill/badge                  | Prefer a typed Relay presentation primitive; no Brain                                     |
| Serious Learner badge      | styled `<span>`        | Relay static pill/badge                  | Prefer a typed Relay presentation primitive; no Brain                                     |
| Decorative crown           | text emoji `👑`        | Feature/Relay icon slot                  | Keep decorative when visible text supplies the accessible name                            |
| Decorative graduation cap  | text emoji `🎓`        | Feature/Relay icon slot                  | Keep decorative when visible text supplies the accessible name                            |
| Empty copy                 | styled `<span>`        | Relay presentation                       | Plain semantic text is sufficient; no Brain                                               |
| Translation                | `TranslatePipe`        | Existing i18n layer                      | Preserve translation ownership                                                            |
| Badge data                 | `AuthService` signal   | Feature/service layer                    | Do not move auth/data concerns into Relay/Spartan                                         |
| Loading/error distinction  | not represented        | Feature/service layer first              | Requires explicit data-state contract before a distinct Relay state can be rendered       |

### Existing Relay primitive candidates

`AppPillComponent` is the closest existing Relay primitive. It is presentation-only and already owns:

- `rounded-pill` geometry;
- semantic Relay token classes;
- small/medium sizing;
- projected or input label content;
- logical inline padding.

That makes it a better conceptual fit than `AppChipComponent`.

`AppChipComponent` is **not** a drop-in replacement: it renders a Spartan button, exposes `aria-pressed`, click output, and optional removal behaviour. Using it for earned badges would incorrectly make read-only status look and behave interactive.

### Primitive prerequisite decision

No Spartan Brain primitive is required.

Before #6159/#6160 converts the markup to `AppPillComponent`, verify that the Relay pill can express the approved VIP and Serious Learner visual roles without `customClass` becoming an escape hatch for feature-owned product styling.

Current `AppPillComponent` variants are `primary`, `success`, `warning`, `danger`, `info`, and `neutral`. They do not directly represent the current VIP gradient (`vip` -> `accent`) or Serious Learner gradient (`secondary` -> `success`). The follow-up implementation should choose one of these explicit paths:

1. adopt an existing semantic solid pill variant if Claude Design defines that as the new contract; or
2. extend the Relay pill with narrowly typed product variants (for example a VIP status variant) when that treatment is genuinely reused/approved.

Do not preserve the gradients by passing arbitrary feature-specific Tailwind strings through `customClass` unless the architecture review explicitly accepts that ownership.

## Visual/token audit

Current VIP classes:

```text
rounded-full bg-gradient-to-r from-vip to-accent px-3 py-1 text-xs font-semibold text-on-fill
```

Current Serious Learner classes:

```text
rounded-full bg-gradient-to-r from-secondary to-success px-3 py-1 text-xs font-semibold text-on-fill
```

Positive findings:

- text on saturated fills already uses `text-on-fill` rather than hardcoded white;
- `secondary`, `success`, `vip`, and `accent` are token names rather than literal hex values;
- the icon gap uses logical `me-1`, so the existing directional spacing is RTL-safe;
- `flex-wrap` allows multiple status items to move to another line.

Risks to resolve in #6160:

- the feature owns pill radius/padding/font treatment instead of the Relay pill API;
- `rounded-full` should converge on the Relay `rounded-pill` hierarchy if the visual contract is pill-shaped status;
- gradients combine product semantic roles in feature markup, making theme/contrast ownership harder to centralise;
- `accent` must not be assumed to mean the per-user dynamic primary role; the architecture explicitly defines `primary` as user-accent-aware;
- the Serious Learner `secondary -> success` gradient mixes partner colour and success semantics even though the badge represents a durable status, not a success message;
- long translations may make an individual inline-flex badge wider than narrow containers even though the outer group wraps.

#6160 should determine the final semantic colour role from Relay/Claude Design rather than mechanically translating the current gradient.

## Accessibility audit

### Current strengths

- status names are visible text, so each badge has human-readable content;
- the surface is non-interactive, so it does not pollute keyboard focus order;
- no synthetic roles or `tabindex` values are present;
- badge layout does not depend on physical left/right utilities.

### Risks

#### Emoji announcement noise

The crown and graduation-cap are raw text emoji. Screen readers may announce both the emoji name and the visible translated badge label. Because the translated text already communicates the status, the icon should normally be treated as decorative in the converted structure, for example with an `aria-hidden="true"` wrapper.

Do not hide the translated badge name itself.

#### Collection semantics

When two badges are present they form a conceptual collection of earned statuses, but the current wrapper and children have no list semantics. This is not necessarily a WCAG failure for such a small status group, but #6161 should make a deliberate choice:

- keep neutral grouping if surrounding context already names the content; or
- use list/list-item semantics when the status collection benefits from being announced as a set.

Do not add `role="button"` or selectable semantics.

#### Empty/loading/error semantics

`badges.none` is static copy. It should not be an `aria-live` region merely because data loads asynchronously unless product UX specifically requires an announcement. Introducing a live region could announce a misleading transient "no badges" state during startup because `null` and empty are currently conflated.

#### Colour independence

VIP and Serious Learner are identified by translated text and icon as well as colour. Preserve that; colour alone must never distinguish the statuses.

## Keyboard, pointer, and focus contract

Because the component is read-only:

- Tab must skip the badge surface;
- no badge should gain pointer cursor, hover-only meaning, `tabindex`, or pressed/selected state;
- no touch target requirement applies unless a future product change makes a badge actionable;
- focus order belongs entirely to surrounding content;
- #6159 must not introduce focus styles simply by replacing spans with an interactive primitive.

If future badges become links to benefit/status details, that is new product behaviour and requires a separate route/interaction specification rather than being folded into this migration.

## RTL and bidirectional text

Current layout is mostly direction-safe:

- `flex-wrap` is direction-agnostic;
- icon spacing uses `me-1` rather than a physical margin;
- there are no `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, or `pr-*` utilities.

Follow-up requirements:

- preserve logical inline padding in any Relay primitive;
- let document/locale direction drive item flow naturally;
- do not reverse badge priority manually for RTL unless product design explicitly requires it;
- validate mixed-direction translated labels without embedding directional marks in translation strings.

## Internationalisation

Current user-facing copy uses `TranslatePipe`:

- `badges.vip`
- `badges.seriousLearner`
- `badges.none`

Preserve those keys unless copy changes are separately approved.

The migration must not move styling or semantic variants into translation dictionaries.

Validate long text and scripts with wider glyphs. Badge labels must be allowed to grow/wrap rather than clip or ellipsize status meaning at 390px and high zoom.

`vipTier` is not currently rendered, so the migration must not start exposing untranslated tier values such as `free` merely because they are available in the data model.

## Theme and user-accent contract

#6160 must verify both light and dark themes independently.

Requirements:

- fills, text, borders, radius, and any shadow use Relay-owned semantic tokens;
- `text-on-fill` remains the text role for saturated fills;
- if user accent should affect an earned-status badge, use the canonical dynamic `primary` role rather than assuming another token tracks the user preference;
- VIP identity must remain recognisable without depending on insufficient-contrast colour combinations;
- do not introduce hardcoded white, black, or product hex colours;
- reduced-motion support is currently trivial because the component has no animation; keep it that way unless design explicitly introduces non-essential motion.

## Responsive, zoom, and reflow contract

The current group uses `flex flex-wrap gap-2`, which is a good mobile-first basis.

#6160/#6161 should verify:

- 390px mobile baseline;
- tablet and desktop host widths;
- 200% zoom;
- 400% zoom/reflow;
- both badges visible simultaneously;
- long translated badge names;
- no horizontal page scrolling caused by a single badge;
- no clipping of emoji or text at increased font size;
- surrounding host content is not displaced in a way that hides required actions.

Because there are no controls, the key zoom requirement is preservation of content rather than touch-target placement.

## Data and privacy boundaries

The component displays only entitlement/learning-status flags already present in authenticated user state. It does not receive raw credentials, payment details, or API keys.

Do not move Supabase access into the component or a Relay primitive.

Do not log badge state from presentation code. `AuthService`/`SupabaseService` remain the data boundary.

A separate product/privacy decision is required if these badges are ever reused on public profiles. This audit covers the current component contract only and does not broaden the visibility of authenticated-user status.

## Migration risks

1. **False interaction:** using `AppChipComponent` would introduce button and pressed-state semantics where none exist.
2. **State regression:** treating `null` as a dedicated loading/error state without changing the service contract would alter current behaviour.
3. **Visual semantic drift:** mapping the gradients mechanically could continue mixing status, partner, success, and accent roles rather than using the approved Relay role.
4. **Theme drift:** feature-owned gradient combinations may have different contrast behaviour across themes.
5. **Accessibility noise:** unhidden emoji can duplicate the spoken badge meaning.
6. **Translation overflow:** long labels can exceed a narrow parent if the pill itself is not allowed to reflow safely.
7. **Data expansion:** rendering `vipTier` would be an unrelated product change.
8. **Ordering drift:** a refactor could reorder the two badges; preserve VIP then Serious Learner unless design explicitly changes priority.
9. **Empty-state flicker/meaning:** the current signal contract conflates null/error/empty; do not add announcements around that ambiguity.
10. **Primitive escape hatch:** using `AppPillComponent.customClass` for whole feature-specific visual recipes would leave design ownership in the feature despite nominal primitive usage.

## Recommended implementation sequence

### #6159 - controls/interactions

- Confirm there is no interactive behaviour to migrate.
- Do not introduce Brain or Helm interaction primitives.
- If convergence work is included, use a **static Relay presentation primitive**, not `AppChipComponent`.
- Preserve the AuthService signal contract and badge ordering.

### #6160 - Relay tokens/theme/responsive

- Decide the approved semantic appearance for VIP and Serious Learner in Claude Design/Relay.
- Prefer `AppPillComponent` ownership for radius, padding, typography, and semantic colours.
- Extend the Relay pill with a typed status variant only if the required status treatment cannot be expressed by an existing approved variant.
- Remove feature-owned gradient/radius styling once the Relay representation is sufficient.
- Verify 390px, tablet, desktop, light, dark, and user-accent scenarios.

### #6161 - accessibility/RTL/zoom/input methods

- Mark decorative emoji appropriately when visible text already supplies the accessible label.
- Decide collection semantics deliberately.
- Confirm the read-only surface remains outside the tab order.
- Verify logical direction, long translations, 200% zoom, and 400% reflow.
- Do not add live announcements for the ambiguous startup/empty state without first fixing the data-state contract.

### #6162 - regression/design preview

- Lock all data/rendering states with focused unit tests.
- Add explicit semantics assertions so static badges cannot accidentally become controls.
- Represent light/dark and mobile/wider visual states in the mapped Relay + Spartan design preview after the visual contract changes.
- Update the audit/design status to reflect the final implementation.

## Regression matrix

At minimum, the completed migration series should cover:

1. component creation;
2. `null` badge signal follows the intentionally chosen current/new state contract;
3. no-badge state renders translated `badges.none`;
4. VIP-only state renders one VIP status;
5. Serious-Learner-only state renders one learner status;
6. both statuses render both badges;
7. VIP precedes Serious Learner when both render;
8. `vipTier` does not appear unless a separate requirement adds it;
9. badge labels use translated content;
10. decorative icons do not duplicate the accessible name after the a11y pass;
11. static badges are not buttons, links, or focusable controls;
12. no `aria-pressed`/selection semantics are introduced;
13. no physical-direction spacing utilities are introduced;
14. 390px layout keeps all required status content visible;
15. long translations reflow without clipping or horizontal page scroll;
16. light theme passes semantic-token/contrast review;
17. dark theme passes semantic-token/contrast review;
18. user-accent changes do not produce off-token or unreadable status styling;
19. 200% zoom preserves complete labels;
20. 400% zoom/reflow preserves complete labels;
21. surrounding host focus order is unchanged;
22. there are still no route, analytics, or mutation side effects in the component.

## Current test coverage

The existing `earned-badges.component.spec.ts` covers:

- component creation;
- VIP-only rendering;
- Serious-Learner-only rendering;
- simultaneous VIP + Serious Learner rendering;
- no-badge copy when both flags are false.

The suite does not currently lock:

- `null` signal behaviour;
- translated accessible semantics beyond visible text;
- absence of interactive roles/tab stops;
- badge ordering explicitly;
- decorative-icon accessibility;
- RTL/logical-class invariants;
- responsive/high-zoom presentation;
- light/dark visual parity.

Those gaps belong primarily to #6161/#6162 unless an earlier implementation stage changes the corresponding contract.

## Verification guidance

For a documentation-only audit such as #6158, no runtime contract changes, test changes, or design-preview changes are required. The PR should still pass repository CI.

For implementation tickets, use the repository frontend gate from `docs/spartan-relay-architecture.md`:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Run the focused `EarnedBadgesComponent` tests while iterating, then the complete required gate before merge.

## Audit conclusion

`EarnedBadgesComponent` is already behaviourally simple: it is a read-only projection of authenticated badge status and has **zero interactive controls to hand over to Spartan Brain**.

The migration should focus on presentation ownership and quality rather than interaction conversion. The strongest target is a static Relay pill/badge contract, with `AppPillComponent` as the existing candidate. `AppChipComponent` is explicitly unsuitable because it creates interactive button semantics.

The main implementation risks are the currently conflated null/error/empty data state, feature-owned gradient/status styling, decorative emoji announcement noise, and long-label/theme/reflow coverage. None requires weakening the existing AuthService/Supabase boundary or adding a new interaction state machine.

This mapping satisfies #6158's audit objective and provides the implementation baseline for #6159-#6162.
