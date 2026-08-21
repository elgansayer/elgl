# Desktop sidebar Spartan / Relay audit

Issue: #6101 (`Spartan UI 0321`)

Target: `frontend/src/app/components/desktop-sidebar`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Implementation status

Issue #6102 implements the audit's active-route correction while retaining native anchors and Angular Router ownership. Active primary and economy links now use `ariaCurrentWhenActive="page"`, inactive links omit `aria-current`, and the component suite is enabled with focused coverage for route inventory, native link semantics, focus treatment and active-route state. The mapped component-system preview records the same active navigation contract.

The remaining sections preserve the original audit baseline and longer-term opportunities. Statements describing `[attr.aria-current]="false"` or the skipped suite refer to the pre-#6102 implementation.

## Scope

This document is the implementation baseline for migrating and maintaining the desktop sidebar under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control, state, route, tour hook, badge, presentation utility and externally observable contract in `DesktopSidebarComponent`. It is intentionally behaviour-neutral. The implementation stage must preserve navigation, unread-count semantics, the coin-economy product tour and desktop/mobile shell boundaries while moving reusable interaction or presentation concerns into the approved ownership layer.

The component currently uses native semantic navigation and Angular Router rather than hand-rolled keyboard behaviour. A migration must not add Spartan Brain solely to increase framework usage. Spartan's Sidebar capability is a candidate for shared navigation composition, but the repository does not currently have a checked-in Helm `sidebar` directory. The implementation stage must verify the installed Spartan version and exact Sidebar API before choosing it.

## Discovery summary

The current implementation consists of:

- `desktop-sidebar.component.ts`, which defines five primary navigation items and reads `UnreadCounterService`;
- `desktop-sidebar.component.html`, which renders the navigation surface, route links, unread badges and three `ngx-joyride` tour anchors;
- `desktop-sidebar.component.spec.ts`, whose entire suite is currently disabled with `describe.skip`;
- Angular route definitions for all nine destinations exposed by the sidebar;
- `UnreadCounterService`, which owns the five per-tab count signals and the browser app-badge side effect.

Recent repository history also matters to this migration:

- Relay Phase 4 already retinted the desktop sidebar onto semantic surface, text, primary, danger and on-fill tokens.
- The coin-economy onboarding work added the Shop, Sticker Store and VIP links plus their Joyride step contracts.
- The unread-counter work changed the primary navigation from one aggregate count to per-tab counts.

Those changes are current behaviour and must not be accidentally reverted by the Spartan migration.

## Current surface

At desktop widths the component renders one navigation landmark with:

1. a translated application title;
2. five primary navigation links for Chat, Moments, Discovery, Audio Rooms and Profile;
3. an optional unread badge on each primary link;
4. a translated Coin Economy section label;
5. three economy links for Shop, Sticker Store and VIP;
6. Joyride step metadata on all three economy links;
7. a Settings link anchored at the bottom of the sidebar.

There are nine focusable route links in total. The surface contains no form controls, menu buttons, disclosure controls, local dialogs, popovers, text inputs, checkboxes, selects or mutations.

The sidebar is hidden below the Tailwind `lg` breakpoint. Mobile navigation is therefore a shell-level sibling responsibility and route parity must be preserved when the desktop implementation changes.

## Existing implementation inventory

| Element / behaviour        | Current implementation                                                      | State owner                | Target owner                                       | Action                                                              |
| -------------------------- | --------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Navigation landmark        | Native `<nav>` with translated `aria-label`                                 | Native semantics           | Feature shell / Relay composition                  | Keep native semantics                                               |
| Desktop visibility         | `hidden lg:flex`                                                            | Responsive layout          | Relay / app shell                                  | Preserve                                                            |
| Fixed sidebar geometry     | `w-64 h-full`, column layout                                                | Feature layout             | Relay / app shell                                  | Preserve unless design contract changes                             |
| Sidebar surface            | `bg-surface-200 border-e border-surface-100`                                | Relay tokens               | Relay                                              | Keep semantic tokens                                                |
| Product title              | translated `app.title` text                                                 | App content                | Relay / app composition                            | Keep                                                                |
| Primary navigation list    | Native `<ul>` / `<li>`                                                      | Native semantics           | Feature shell / Relay composition                  | Keep semantic list structure                                        |
| Primary route links        | Native `<a>` + `RouterLink`                                                 | Angular Router             | Angular Router plus approved Relay navigation item | Preserve route/link semantics                                       |
| Active visual state        | `RouterLinkActive="bg-surface-100 text-primary"`                            | Angular Router             | Angular Router plus Relay tokens                   | Preserve                                                            |
| Active accessibility state | `[attr.aria-current]="false"` on primary links                              | Feature template           | Angular Router / navigation item                   | Fix during migration: current page must be exposed programmatically |
| Route matching             | `routerLinkActiveOptions` from `item.exact`; all current values are `false` | Feature config + Router    | Feature route contract                             | Preserve unless route policy explicitly changes                     |
| Primary icons              | Decorative Unicode emoji with `aria-hidden="true"`                          | App presentation           | Relay / icon composition                           | Preserve semantics; use approved icon stack if visuals change       |
| Unread state               | `UnreadCounterService.tabCount(item.tab)`                                   | UnreadCounterService       | Feature data + Relay badge presentation            | Preserve                                                            |
| Unread badge visibility    | Render only when count is greater than zero                                 | Feature template           | Feature state + Relay presentation                 | Preserve                                                            |
| Unread badge cap           | Values greater than 99 render as `99+`                                      | Feature template           | Product behaviour                                  | Preserve                                                            |
| Unread badge styling       | `bg-danger text-on-fill`, logical `ms-auto`                                 | Relay tokens               | Relay                                              | Keep semantic roles                                                 |
| Coin Economy label         | Translated `coinEco.sectionTitle` span                                      | App content                | Relay / semantic group labelling                   | Preserve copy; improve grouping semantics if practical              |
| Shop link                  | `/shop`, translated label                                                   | Angular Router             | Navigation item                                    | Preserve                                                            |
| Sticker Store link         | `/sticker-store`, translated label                                          | Angular Router             | Navigation item                                    | Preserve                                                            |
| VIP link                   | `/vip`, translated label                                                    | Angular Router             | Navigation item                                    | Preserve                                                            |
| Economy active state       | `RouterLinkActive="bg-surface-100 text-primary"`                            | Angular Router             | Angular Router plus Relay tokens                   | Preserve                                                            |
| Joyride Shop step          | `tourShopNav` with translated title/text, `stepPosition="end"`              | `ngx-joyride`              | Existing tour integration                          | Preserve exactly unless a separate tour migration is approved       |
| Joyride Sticker step       | `tourStickerNav` with translated title/text, `stepPosition="end"`           | `ngx-joyride`              | Existing tour integration                          | Preserve exactly                                                    |
| Joyride VIP step           | `tourVipNav` with translated title/text, `stepPosition="end"`               | `ngx-joyride`              | Existing tour integration                          | Preserve exactly                                                    |
| Settings link              | `/settings` native RouterLink                                               | Angular Router             | Navigation item                                    | Preserve                                                            |
| Settings active styling    | No `RouterLinkActive` currently                                             | None                       | Navigation policy                                  | Record as current divergence; decide explicitly in implementation   |
| Focus indication           | Focus-visible primary ring and offset on every link                         | Feature Tailwind utilities | Shared navigation item / Relay                     | Preserve or centralise without weakening visibility                 |
| Hover state                | Semantic surface/text token changes                                         | Relay tokens               | Relay                                              | Preserve                                                            |
| Colour transition          | `transition-colors`                                                         | Presentation               | Relay                                              | Preserve unless motion policy changes                               |
| Analytics                  | No analytics hook in this component                                         | None                       | Feature/application layer                          | Do not invent as part of migration                                  |
| API/mutation               | No API call or mutation in this component                                   | None                       | Outside component                                  | Do not add                                                          |
| Overlay mechanics          | No local overlay; Joyride may render its own guided-tour overlay            | `ngx-joyride`              | Existing tour provider                             | Do not replace incidentally                                         |

## Route contract

All current sidebar destinations exist in the application route table and are part of the behaviour contract.

| Surface       | Route            | Translation key    | Unread source | Notes                                                  |
| ------------- | ---------------- | ------------------ | ------------- | ------------------------------------------------------ |
| Chat          | `/chat`          | `nav.helloTalk`    | `chat`        | Descendant matching currently allowed                  |
| Moments       | `/moments`       | `nav.moments`      | `moments`     | Descendant matching currently allowed                  |
| Discovery     | `/discovery`     | `nav.connect`      | `discovery`   | Descendant matching currently allowed                  |
| Audio Rooms   | `/audio-rooms`   | `nav.liveRooms`    | `audioRooms`  | Descendant matching currently allowed                  |
| Profile       | `/profile`       | `nav.profile`      | `profile`     | Uses notification count through `UnreadCounterService` |
| Shop          | `/shop`          | `nav.shop`         | none          | Joyride step target                                    |
| Sticker Store | `/sticker-store` | `nav.stickerStore` | none          | Joyride step target                                    |
| VIP           | `/vip`           | `nav.vip`          | none          | Joyride step target                                    |
| Settings      | `/settings`      | `nav.settings`     | none          | Bottom-pinned link, no active style today              |

The implementation stage must not rename, redirect or broaden these routes as an incidental design-system change. If route ownership changes elsewhere, the sidebar should consume that separately reviewed contract.

## State model

The component has no local writable signal state. Its rendered state is derived from viewport, Router state and `UnreadCounterService`.

| State dimension      | Values                                        | User-visible result                                         |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Viewport             | below `lg` / `lg` and above                   | Sidebar hidden / sidebar displayed                          |
| Route state          | inactive / active                             | Default link / active token treatment                       |
| Primary unread count | 0 / 1-99 / 100+                               | no badge / numeric badge / `99+`                            |
| Tour state           | inactive / matching Shop, Sticker or VIP step | ordinary link / link acts as the Joyride target             |
| Theme                | light / dark                                  | Relay semantic tokens resolve to the current theme          |
| Primary accent       | default / user-customised                     | active text and focus ring follow the current primary token |
| Direction            | LTR / RTL                                     | logical borders and badge spacing mirror automatically      |

There is no component-owned loading, error, retry, success, disabled, pending or optimistic state.

### Unread-count ownership

`DesktopSidebarComponent` only reads `UnreadCounterService.tabCount(tab)`. It does not load counts, increment them, clear them or update the operating-system app badge.

The service owns those behaviours. The migration must not move unread mutations or browser Badge API calls into the navigation component.

Profile uses the service's `profile` tab, which currently maps to `notificationUnread`. This naming mismatch is existing service behaviour and should be preserved unless a separate unread-domain ticket changes it.

## Spartan ownership

### Native navigation remains valid

A semantic `<nav>` containing ordinary anchors is already keyboard-operable and does not need a Brain state machine. Angular Router correctly owns client-side route activation. Do not replace native links with buttons or create nested interactive elements merely to make the surface look more Spartan.

Spartan Brain should be introduced only where it provides a real reusable interaction contract that native navigation plus Angular Router does not already provide.

### Spartan Sidebar is a candidate, not an assumed dependency

The repository Spartan guidance lists `sidebar` among navigation capabilities, but the checked-in Helm inventory does not currently contain `frontend/src/app/components/ui/sidebar`.

Before implementation:

1. run the project's supported `@spartan-ng/cli:info --json` command;
2. inspect `installedComponents` and `availableComponents`;
3. confirm the exact Sidebar selectors, imports, RouterLink composition, collapse behaviour and accessibility contract through the installed Spartan version or current Spartan documentation;
4. if Sidebar is selected, add it through `@spartan-ng/cli:ui` rather than recreating generated Helm code manually;
5. do not import Brain directly into the feature when a Helm or Relay surface can own the behaviour.

If the application has multiple desktop navigation surfaces with the same interaction class, prefer a small Relay navigation wrapper or navigation-item primitive over repeated feature-specific class strings. Relay should expose product-level route, active, icon, badge and label semantics without leaking Spartan implementation types.

If Spartan Sidebar adds no useful behaviour for this fixed desktop shell, retaining native navigation inside a Relay composition is acceptable. The goal is correct ownership, not framework usage for its own sake.

### Relay ownership

Relay owns:

- sidebar surface and border roles;
- text hierarchy and muted/active roles;
- active, hover and focus visual treatment;
- spacing, radius and density;
- unread badge appearance;
- theme parity;
- per-user primary accent behaviour;
- responsive desktop layout;
- any reusable product-facing navigation item API introduced by the implementation.

The current template already uses semantic Relay tokens rather than hardcoded product colours. Do not regress to stock palette classes during migration.

## Joyride contract

The Shop, Sticker Store and VIP anchors are more than ordinary links because `ngx-joyride` attaches the coin-economy guided tour to those exact focusable targets.

The implementation must preserve:

- `tourShopNav`, `tourStickerNav` and `tourVipNav` step identifiers;
- `tour.stepShopNav.title` / `tour.stepShopNav.text`;
- `tour.stepStickerNav.title` / `tour.stepStickerNav.text`;
- `tour.stepVipNav.title` / `tour.stepVipNav.text`;
- the current `stepPosition="end"` intent;
- a stable, rendered focusable target for each step.

Do not wrap an anchor in a component in a way that causes Joyride to bind to a non-focusable host while the actual link moves deeper into the DOM.

Joyride owns its current tour overlay. Replacing that overlay with Spartan Dialog, Popover or Tooltip is outside this ticket unless a separate product-tour migration explicitly establishes equivalent sequencing, focus, Escape, placement and analytics behaviour.

### RTL placement risk

The template uses logical layout utilities, but `stepPosition="end"` is interpreted by a third-party library. The implementation stage must verify whether Joyride's `end` placement is direction-aware in RTL rather than assuming the attribute mirrors automatically.

## Accessibility audit

### Existing strengths

The current implementation already provides:

- a semantic `nav` landmark with a translated accessible label;
- native anchors for route actions;
- semantic unordered lists for navigation groups;
- visible focus rings using the dynamic primary token;
- decorative icons hidden from assistive technology;
- translated visible labels and accessible labels;
- logical layout rather than physical left/right positioning;
- semantic danger/on-fill tokens for unread badges.

### Active route semantics

The largest accessibility defect is `[attr.aria-current]="false"` on every primary link. The visually active route can therefore remain programmatically reported as not current.

The implementation stage must expose the active page through `aria-current="page"` on the actual active link and remove it or set it appropriately on inactive links. Prefer Angular Router's supported `RouterLinkActive` aria-current mechanism if the installed Angular version provides the required contract. Verify the exact API instead of manually duplicating Router state.

The fix must be regression-tested for both active and inactive routes.

### Settings active-state divergence

The Settings link has no `RouterLinkActive`, unlike the other eight links. This means `/settings` has no equivalent active visual state today.

The audit records this as an existing divergence rather than silently changing behaviour. The implementation should make a deliberate product decision: either bring Settings into the shared active-navigation contract, including `aria-current`, or explicitly document why the bottom utility link is intentionally different.

### Unread badge semantics

Unread badges are descendants of their anchors and currently contain only the raw count or `99+`. A screen reader may announce the number after the link label, but the meaning of that number is not guaranteed to be clear.

The implementation should provide a translated accessible unread-count relationship without duplicating noisy announcements. Options include visually hidden translated count text associated with the link or an accessible label that combines the route name and count. Do not add `aria-live` automatically: live announcement of frequently changing navigation counts is a product accessibility decision and can become disruptive.

The visual `99+` cap may remain while the accessible text can describe the threshold in a translated form if product requirements call for it.

### Landmark and grouping semantics

`role="navigation"` is redundant on a native `<nav>` but not harmful. It can be removed if the resulting landmark remains labelled.

The Coin Economy section label is a visual `span`, not a structural group heading. If the navigation is restructured, associate that translated label with the relevant list or group through native heading/grouping semantics without introducing an extra focus stop.

### Focus and target size

The current focus-visible ring must remain clearly visible in both themes and with a custom primary accent. A shared navigation item must not suppress native focus or move the ring to a non-interactive wrapper.

The current links use `px-4 py-3`; the implementation should verify that the final composition retains an appropriate touch/click target and does not shrink due to a compact Sidebar default.

### Zoom and reflow

At high browser zoom the effective CSS viewport may cross below `lg`, causing the desktop sidebar to disappear. This is acceptable only if the mobile navigation becomes available with equivalent destinations and no feature becomes unreachable.

Regression coverage should verify route parity at 200% and 400% zoom/reflow and ensure fixed `w-64` geometry never causes essential content clipping while the desktop sidebar remains active.

### Small text

The Coin Economy heading and unread badge use `text-[10px]`. During visual implementation, verify legibility and contrast at zoom and under font scaling. If the shared Relay typography scale has an appropriate semantic role, prefer it to an arbitrary text size.

## Internationalisation and RTL

All user-facing navigation copy is translated through `TranslatePipe`:

- the navigation landmark label;
- the application title;
- all nine route labels;
- the Coin Economy section label;
- all Joyride titles and body text.

The unread number and decorative emoji are not translatable strings.

The current directional utilities are RTL-safe: `border-e` and `ms-auto` are logical. No physical `left`, `right`, `ml`, `mr`, `pl`, `pr`, `border-l` or `border-r` utility is required by the surface.

The implementation must additionally verify:

- long translated route labels in the fixed-width sidebar;
- CJK, Arabic, Cyrillic and Devanagari labels using the system font stack;
- badge alignment in RTL;
- Joyride `end` placement in RTL;
- translated unread-count accessibility text if added;
- uppercase transformation of the economy heading does not produce inappropriate product copy for scripts/locales where casing does not apply.

Do not move style classes into translation data.

## Theme and token audit

The existing surface is already on Relay semantic tokens:

- `bg-surface-200` and `bg-surface-100` for shell and active/hover surfaces;
- `border-surface-100` for the logical divider;
- `text-text-secondary`, `text-text-primary` and `text-text-muted` for hierarchy;
- `text-primary` and `ring-primary` for active/focus treatment;
- `bg-danger text-on-fill` for unread badges.

This gives light/dark parity and inherits per-user primary accent changes. The migration must keep these semantic roles or map them through an approved Relay wrapper. No new hardcoded product hex or stock Tailwind colour should be introduced.

The sidebar does not currently use the primary/secondary duet as a paired-person surface, so no additional secondary accent is required solely for design-system compliance.

## Responsive contract

The current shell is desktop-only:

- hidden below `lg`;
- flex column at `lg` and above;
- fixed width `w-64`;
- full available height;
- settings link pushed to the bottom with `mt-auto`.

The migration should not turn this component into a mobile drawer without a separate shell/navigation decision. Mobile-first support is achieved at application-shell level through an alternate navigation composition, not by making two competing mobile navigations visible simultaneously.

Before changing breakpoints or route inventory, inspect the mobile navigation sibling and prove parity.

## Migration risks

### 1. Replacing an anchor with the wrong primitive

A navigation item is a link, not a button. Any Relay or Spartan composition must keep an actual anchor with `RouterLink` and an appropriate accessible name. Avoid nested `<a>` or `<button>` elements.

### 2. Losing RouterLinkActive behaviour

Moving classes into a wrapper can accidentally leave `RouterLinkActive` on a host that no longer reflects the active anchor. Tests must verify the actual focusable link receives active visual and programmatic state.

### 3. Preserving the existing `aria-current` defect

A purely visual migration could retain `[attr.aria-current]="false"`. The implementation ticket should treat this as a required accessibility correction, not a visual detail.

### 4. Breaking Joyride targets

Component encapsulation can change the DOM node that Joyride sees. Preserve the three current step identifiers and attach them to stable rendered targets.

### 5. Losing unread-count reactivity

A shared navigation data model must continue reading the live signal-backed `tabCount` result. Do not snapshot counts into a non-reactive array during construction.

### 6. Changing route matching

The five primary links explicitly use non-exact route matching. Reusable route-item code must preserve this policy unless product behaviour is intentionally changed.

### 7. Desktop/mobile parity regression

Changing breakpoint, route list or shell positioning can make a destination unavailable when the sidebar disappears. Verify the mobile sibling before altering navigation structure.

### 8. Creating a second navigation design system

Do not add ad hoc `app-desktop-nav-item` and a separate Spartan Sidebar family if one reusable Relay abstraction can own the product contract. Conversely, do not introduce a large new wrapper if native links plus the current feature composition are sufficient.

### 9. Importing Brain directly

Feature code should not import `@spartan-ng/brain/*` when a generated Helm or Relay layer can own the interaction. Brain is not a styling API.

### 10. Icon migration drift

If emoji are replaced with generic vector icons, use the repository's `@ng-icons/core` plus Lucide stack and register icons with `provideIcons`. Do not mix a second icon library into the navigation migration.

### 11. Test blind spot

`desktop-sidebar.component.spec.ts` currently uses `describe.skip`, so the existing tests provide no protection in normal runs. Re-enabling and expanding this suite is a prerequisite for behaviour-changing implementation.

### 12. Third-party tour overlay assumptions

Do not assume a Spartan Tooltip or Popover can replace Joyride. Product tours have sequencing and lifecycle concerns beyond a single anchored overlay.

## Prerequisite primitive work

No new primitive is required to complete this audit.

Before the implementation ticket changes markup, perform the following discovery:

1. run Spartan CLI info and confirm whether Sidebar is available in the installed version;
2. inspect any current mobile/sidebar/navigation shell components for a reusable Relay contract;
3. decide whether the application benefits from a shared Relay navigation item/sidebar wrapper or should keep native anchors in feature composition;
4. if Spartan Sidebar is selected, generate the Helm component through the official CLI;
5. verify RouterLink and RouterLinkActive composition against the exact generated markup;
6. confirm Joyride directives can remain attached to the focusable anchors;
7. define the accessible unread-count and active-route contract before implementation.

Do not generate a Sidebar merely because it appears in the Spartan catalogue. The selected primitive must solve an actual reusable interaction or composition need.

## Required regression coverage for implementation

The existing skipped test suite should be re-enabled and expanded to cover at least:

| Scenario             | Expected contract                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Component creation   | Sidebar mounts with required services/router                                                          |
| Landmark             | One labelled navigation landmark is exposed                                                           |
| Route inventory      | Exactly the intended nine route links are rendered                                                    |
| Primary routes       | `/chat`, `/moments`, `/discovery`, `/audio-rooms`, `/profile` remain present                          |
| Economy routes       | `/shop`, `/sticker-store`, `/vip` remain present                                                      |
| Settings route       | `/settings` remains present                                                                           |
| Active route         | Active focusable link receives Relay active treatment                                                 |
| Active accessibility | Active link exposes `aria-current="page"`; inactive links do not                                      |
| Settings state       | The deliberate Settings active-state policy is covered                                                |
| Unread zero          | No badge is rendered                                                                                  |
| Unread 1-99          | Current count renders and is accessible with useful context                                           |
| Unread 100+          | Visual value is capped at `99+`                                                                       |
| Reactivity           | Updating each service signal updates the matching badge                                               |
| Focus                | Every link remains keyboard focusable with visible focus treatment                                    |
| Translation          | Landmark, navigation and section labels come from translation keys                                    |
| RTL                  | No physical-direction utilities are introduced and badge alignment mirrors                            |
| Joyride              | All three step identifiers and translated title/text bindings remain attached to the intended anchors |
| Theme                | Active/focus/badge roles use Relay semantic tokens                                                    |
| Reflow               | Desktop-to-mobile handoff preserves destination access at high zoom                                   |

For DOM/visual concerns that are brittle in unit tests, add or update the repository's existing E2E/visual coverage rather than asserting internal Spartan implementation details.

## Implementation sequence

A safe follow-up sequence is:

1. re-enable and strengthen the existing desktop-sidebar unit suite;
2. confirm mobile navigation parity and the desired Settings active policy;
3. fix active-route accessibility as part of the shared navigation contract;
4. confirm Spartan Sidebar availability and exact API;
5. choose native/Relay composition or Relay-over-Spartan Sidebar based on actual reuse needs;
6. preserve RouterLink, unread signals and Joyride hooks while changing presentation ownership;
7. verify RTL, light/dark, custom primary accent, high zoom and keyboard focus;
8. update design-preview / Claude Design only if the visual or interaction contract changes;
9. run the full frontend verification gate before merge.

## Verification commands for the implementation stage

Run focused tests while iterating, then the repository-mandated frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

If the implementation changes a mapped visual contract, also run the root design-sync check required by the repository and update the corresponding design-preview / Claude Design mirror.

## Acceptance criteria mapping

- **No interactive element omitted:** all nine route links, three Joyride-enabled links, active-route mechanics, focus behaviour and unread-badge interaction context are inventoried above.
- **Existing behaviour recorded:** routes, non-exact primary matching, unread-count ownership/capping, desktop-only breakpoint, Settings divergence and Joyride contracts are documented.
- **Analytics hooks recorded:** there is no analytics hook in `DesktopSidebarComponent`; Joyride is explicitly documented as a tour integration rather than silently treated as analytics.
- **Migration risks identified:** Router active semantics, Joyride target stability, unread reactivity, mobile parity, third-party overlay behaviour, icon migration and the skipped test suite are explicit risks.
- **Prerequisite primitive work identified:** Spartan Sidebar must be discovered through the installed CLI/API before use, and a Relay navigation wrapper should be introduced only when reuse justifies it.

## Audit conclusion

The desktop sidebar does not currently need a new Brain interaction state machine. Its native navigation and Angular Router semantics should remain authoritative. The most likely productive migration is to centralise reusable visual/navigation-item composition in Relay, optionally backed by Spartan Sidebar only after verifying that the installed primitive provides useful structure without breaking RouterLink or Joyride contracts.

The implementation stage has three high-priority correctness requirements beyond visual ownership: expose the active route programmatically instead of forcing `aria-current="false"`, preserve live per-tab unread counts, and keep the three coin-economy Joyride targets intact. Re-enabling the skipped component test suite is required before those behaviours are changed.
