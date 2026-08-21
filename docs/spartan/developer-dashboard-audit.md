# Developer dashboard Spartan / Relay audit

Issue: #6108 (`Spartan UI 0326`)

Target: `frontend/src/app/components/developer-dashboard`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `DeveloperDashboardComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every interactive control, local state, async state, service side effect, diagnostic surface and presentation primitive in the developer dashboard. It is intentionally behaviour-neutral. The implementation stage must preserve the `/developer` route, Stripe checkout hand-off, API-key generation, PostGIS partner search, Centrifugo connection controls, Redis and LiveKit simulations, and diagnostic-log behaviour while moving reusable interaction concerns into the approved ownership layer.

The component is already partly converged. It uses approved Relay application primitives for cards, chips, inputs, primary buttons and secondary buttons, plus Spartan Helm buttons and checkbox. The main bespoke interaction pattern is the four-way sandbox navigation, which currently behaves like tabs but is implemented as independent buttons without tab semantics or keyboard behaviour.

## Discovery summary

The current implementation consists of:

- `developer-dashboard.component.ts`, which owns local sandbox state and orchestrates `EconomyStore`, `DiscoveryService`, `CentrifugeService` and `AuthService`;
- `developer-dashboard.component.html`, which renders the tier banner, four sandbox sections, controls, results and diagnostic log;
- `developer-dashboard.component.scss`, which only declares `:host { display: block; }`;
- the `/developer` route in `frontend/src/app/app.routes.ts`;
- no colocated `developer-dashboard.component.spec.ts` test file.

There are no dialogs, popovers, drawers, menus or other overlays in this component. There is no Angular Router call inside the component and no product-analytics hook. The developer dashboard does create persistent diagnostic log entries for most actions.

The route is currently public at the router-definition level. It has no `canActivate` guard in `app.routes.ts`. This audit does not change route access policy.

## Current surface

The dashboard renders four main areas:

1. a developer-tier banner with conditional upgrade actions;
2. a four-button sandbox navigation row for Overview, PostGIS, Centrifugo and LiveKit;
3. the active sandbox panel;
4. a diagnostic log surface beneath the sandbox.

Only one sandbox panel is rendered at a time. `activeTab` defaults to `overview`.

The component has no component-owned navigation after it is loaded. The consumer and developer upgrade buttons delegate to `EconomyStore.upgradeVip()`, which may redirect through the verified Stripe checkout flow. That browser redirect is a store/service side effect and must remain outside presentation primitives.

## Existing primitive inventory

| Element / behaviour           | Current implementation                                     | State owner                               | Target owner                                               | Action                                                 |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Tier banner surface           | Semantic Relay token utilities                             | Store plus template                       | Relay / feature composition                                | Preserve                                               |
| Developer upgrade action      | `<button hlmBtn>`                                          | Feature orchestration plus `EconomyStore` | Spartan Helm Button plus feature action                    | Preserve primitive; add pending protection if required |
| Consumer upgrade action       | `<button hlmBtn>`                                          | Feature orchestration plus `EconomyStore` | Spartan Helm Button plus feature action                    | Preserve primitive; add pending protection if required |
| Sandbox navigation            | Four `<button hlmBtn>` controls with `activeTab` checks    | Component signal                          | Spartan Tabs behaviour plus Relay styling                  | Migrate semantics and keyboard behaviour               |
| Overview card surfaces        | `app-card`                                                 | Relay                                     | Relay                                                      | Preserve                                               |
| Generate API key action       | `app-button-primary`                                       | Feature plus `EconomyStore`               | Relay button wrapper plus feature action                   | Preserve                                               |
| API-key status                | `<code>`, `app-chip`, empty-state utility                  | Store                                     | Native text plus Relay presentation                        | Preserve; review sensitive-value exposure              |
| Telemetry statistics          | `app-card` and semantic token utilities                    | Store                                     | Relay                                                      | Preserve                                               |
| Latitude input                | `app-input` with native label                              | Component signal                          | Relay Input wrapper                                        | Preserve                                               |
| Longitude input               | `app-input` with native label                              | Component signal                          | Relay Input wrapper                                        | Preserve                                               |
| Radius control                | Native `input[type=range]`                                 | Component signal                          | Native range unless approved Slider capability is verified | Preserve semantics; do not invent a new dependency     |
| VIP location spoof control    | `hlm-checkbox` inside native label                         | Component signal                          | Spartan Helm Checkbox plus feature state                   | Preserve                                               |
| Execute PostGIS search        | `app-button-primary`                                       | Component plus `DiscoveryService`         | Relay button wrapper plus feature action                   | Preserve; fix state-dependent accessible name          |
| Search results                | Native repeated content, `app-chip`, Relay token utilities | Component signal                          | Relay / feature composition                                | Preserve                                               |
| Search empty state            | `app-empty-state` utility                                  | Component signal                          | Relay empty-state presentation                             | Preserve but distinguish untouched from searched-empty |
| Centrifugo status             | `app-chip`                                                 | `CentrifugeService`                       | Relay chip                                                 | Preserve                                               |
| Centrifugo connect/disconnect | `app-button-secondary`                                     | `CentrifugeService`                       | Relay button wrapper plus service action                   | Preserve; fix state-dependent accessible name          |
| Redis fan-out simulation      | `app-button-primary`                                       | Feature action plus diagnostic store      | Relay button wrapper plus feature action                   | Preserve                                               |
| LiveKit role status           | Text plus Relay token utilities                            | Component signals                         | Relay / feature composition                                | Preserve                                               |
| Raise-hand simulation         | `app-button-primary`                                       | Component signals                         | Relay button wrapper plus feature action                   | Preserve                                               |
| Demote simulation             | `app-button-secondary`                                     | Component signals                         | Relay button wrapper plus feature action                   | Preserve                                               |
| Recording status              | `app-chip`                                                 | Component signal                          | Relay chip                                                 | Preserve                                               |
| Recording toggle              | `app-button-primary`                                       | Component signal plus diagnostic store    | Relay button wrapper plus feature action                   | Preserve; fix state-dependent accessible name          |
| Diagnostic log list           | Native repeated content plus Relay token utilities         | `EconomyStore`                            | Relay / feature composition                                | Preserve                                               |
| Diagnostic empty state        | `app-empty-state` utility                                  | `EconomyStore`                            | Relay empty-state presentation                             | Preserve                                               |

## Spartan ownership decision

### Spartan Brain

The sandbox navigation is the strongest Brain candidate. It is functionally a tab interface because one selected control owns one visible panel. The implementation should use the repository-approved Spartan Tabs behaviour when the checked-in package version and API are verified.

The target behaviour is:

- one tablist for Overview, PostGIS, Centrifugo and LiveKit;
- one selected tab at a time;
- `aria-selected` and tab/panel relationships owned by the primitive;
- predictable Left/Right arrow keyboard navigation with Home/End behaviour if provided by the primitive;
- focus state that remains visible in both themes;
- no change to the default `overview` selection;
- no change to local panel state when switching tabs unless the current product intentionally resets it.

No other current control requires a new Brain state machine. Buttons, checkbox and form controls already have an approved low-level or Relay owner.

### Spartan Helm

The existing `hlmBtn` and `hlm-checkbox` usage is valid low-level ownership and should not be replaced with bespoke controls.

If Tabs are introduced, the implementation should use the repository's supported Helm/Brain Tabs composition rather than recreating roles and keyboard events manually.

Do not add Helm components merely to increase Spartan usage. In particular, keep the native range input unless the repository has an approved Slider capability and migration provides a concrete accessibility or consistency benefit.

### Relay and application primitives

The following existing wrappers already match repository ownership and should be retained:

- `AppCardComponent`;
- `AppChipComponent`;
- `AppInputComponent`;
- `AppButtonPrimaryComponent`;
- `AppButtonSecondaryComponent`;
- semantic Tailwind/Relay tokens such as `bg-primary`, `bg-surface-*`, `text-text-*`, `text-success`, `text-on-fill` and `border-surface-*`.

The SCSS file has no bespoke colour or spacing system to migrate. Most presentation is already expressed through semantic tokens and logical spacing utilities.

## State model

### Dashboard bootstrap

`dashboardData` is an Angular `resource()` whose loader executes both:

- `EconomyStore.loadDeveloperAnalytics()`;
- `EconomyStore.loadDiagnosticLogs()`.

The current template does not render a distinct pending or failed bootstrap state. Existing store defaults therefore stand in for loading data, and a resource failure is not surfaced on the page.

The implementation stage should decide how loading and failure are exposed without changing the meaning of already-loaded empty data. A Relay loading/error treatment is appropriate; this does not require a new Brain primitive.

### Tier and checkout state

The banner reads:

- `store.developerStats()?.tier`;
- `authService.currentUser()?.is_vip`.

Upgrade actions create a diagnostic log and then call `store.upgradeVip(tier)`.

The component has no local pending signal for either checkout action. Repeated activation can therefore issue repeated log/store calls before redirect or failure settles. A migration should preserve the checkout boundary while adding bounded pending/disabled behaviour if the store does not already guarantee idempotency.

VIP status must continue to change only from the verified backend/payment flow. A presentation migration must never optimistically grant VIP status.

### API-key state

The Overview tab has two states:

- API key present: render the full key and active-rate chip;
- no API key: render the empty state.

`generateKey()` delegates to `EconomyStore.generateApiKey()` and then writes a success diagnostic log.

There is no local generating/error state. The implementation must not accidentally expose the key in logs, analytics, HTML attributes or error messages. Any future copy/reveal interaction requires a deliberate product and security decision; it is not part of this audit.

### PostGIS state

The PostGIS sandbox owns:

- `searchLatitude`, default `51.5074`;
- `searchLongitude`, default `-0.1278`;
- `searchRadiusMetres`, default `5000`;
- `spoofVipLocation`, default `false`;
- `discoveryResults`, default empty;
- `isSearching`, default `false`.

`runPostGisSearch()` sends only latitude, longitude, radius and `serious_learner_only: false` to `DiscoveryService.findPartners()`.

The `spoofVipLocation` flag is included in diagnostic text but is not sent in `SearchFilterParams`. A migration must not silently change that product behaviour. If spoofing is intended to affect the backend query, that should be a separate product/API decision with its own tests.

The current empty-results presentation is ambiguous because it appears before any search and after a successful zero-result search. The migration should model at least:

- untouched;
- searching;
- results;
- searched-empty;
- failed.

A failed search currently records a warning diagnostic log but does not show an inline error in the PostGIS panel.

### Centrifugo state

Connection truth comes from `CentrifugeService.isConnected()` and display text from `connectionStatus()`.

`toggleCentrifugo()` either disconnects synchronously or awaits `connect()`, then records a diagnostic log.

The control has no local pending state. A connection attempt may therefore be re-triggered before completion unless the service itself guards this. The implementation should use service state where available rather than inventing a second connection state machine.

### LiveKit simulation state

The local simulator owns:

- role: `listener`, `speaker` or `host`, default `listener`;
- `simulatedCanPublish`, default `false`;
- `isRecordingActive`, default `false`.

Raise Hand moves the local simulation to speaker/can-publish. Demote moves it to listener/cannot-publish. Recording toggles local recording state. Each action writes a diagnostic record.

These are developer simulations, not a real LiveKit session state model. A UI migration must not accidentally replace these local transitions with production stage mutations.

### Diagnostic log state

The page reads `store.diagnosticLogs` and writes through `store.createDiagnosticLog()`.

Diagnostic messages generated by this component are currently hard-coded English strings. Because the logs are visibly rendered in the dashboard, this is a translation-ownership gap even though surrounding labels use `TranslatePipe`.

Some log text can contain:

- coordinates and query radius;
- search failure messages;
- generated simulation identifiers/counts;
- the current user ID or `anon` for a Centrifugo connection;
- infrastructure implementation details.

The migration must not broaden log exposure or send these values into third-party analytics.

## Accessibility audit

### Sandbox navigation

The current four controls look and behave like tabs but expose only button semantics. Missing tab behaviour includes:

- no `tablist` relationship;
- no `tab` roles;
- no `aria-selected`;
- no `aria-controls` / panel relationship;
- no tab-panel role;
- no roving focus or arrow-key navigation.

Using the approved Tabs primitive is preferable to manually recreating these semantics.

### Dynamic accessible names

Three current accessible names can disagree with visible state:

1. the PostGIS execute button always uses `developer.executingBtn` for `aria-label`, including while idle when visible text is `developer.executeBtn`;
2. the Centrifugo button always uses `developer.disconnectBtn`, including while disconnected when visible text is `developer.connectBtn`;
3. the recording button uses a fixed `developer.recordingBtn` label while its visible action changes between starting and stopping recording.

The implementation stage should derive each accessible name from the same state as its visible action text. Do not add duplicate labels where the translated visible text already provides a sufficient name.

### Form controls

Latitude and longitude already have explicit native `<label for>` relationships to their Relay inputs.

The radius range has a native label whose translated text includes the current radius. Preserve that relationship and verify the spoken value/value range in browser accessibility tooling.

The checkbox is wrapped by its visible translated label. Preserve the clickable label relationship when moving markup.

### Async status and errors

`isSearching` disables the PostGIS action, but other async actions have no explicit pending feedback. Bootstrap failure and search failure are not surfaced inline.

Add useful status semantics only where they communicate a real state transition. Avoid a broad `aria-live` region around the entire diagnostic log because high-frequency developer logs would create noisy announcements.

### Focus and zoom

There are no overlays requiring focus trapping or focus restoration.

Tab migration must preserve visible focus styles and keep the active panel reachable at 200% and 400% zoom. Controls must remain operable without horizontal page scrolling at narrow desktop widths where practical. Long translated labels must wrap or reflow rather than overlap status chips or actions.

## Internationalisation and RTL

Most template copy already uses the translation pipe. Preserve that contract.

The component's generated diagnostic strings are the main translation exception. The implementation should either:

- translate user-visible diagnostic messages using stable keys and interpolation; or
- explicitly classify the developer diagnostic stream as English-only technical telemetry under a documented product exception.

Do not leave this accidental.

The template already favours logical padding utilities such as `ps-*` and `pe-*`. Continue using logical inline/block utilities and avoid introducing `ml-*`, `mr-*`, `left-*` or `right-*` for layout meaning.

Coordinate values, API keys, identifiers and protocol names may need direction isolation inside an RTL locale. Test mixed Arabic/Hebrew UI text with Latin identifiers and negative longitude values so punctuation and number order remain understandable.

## Theme and token audit

The current dashboard is largely on the correct semantic-token layer:

- primary/on-fill roles for the hero;
- surface roles for cards and secondary surfaces;
- semantic success/warning roles;
- text-primary/text-secondary roles;
- surface borders.

No bespoke colours exist in the component SCSS.

Implementation work should keep semantic roles rather than replace them with literal Tailwind palette colours. Verify both light and dark themes for:

- selected and unselected tabs;
- disabled/pending buttons;
- success/warning chips;
- range control focus/value visibility;
- code/API-key contrast;
- diagnostic status text;
- focus-visible rings.

A visual-preview change is required only if the shared mapped visual contract changes. This audit itself changes no visual contract.

## Side-effect and contract map

| Action                 | Current side effect                                                                       | Contract to preserve                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Upgrade developer      | Diagnostic log, then `EconomyStore.upgradeVip('developer')`                               | Verified checkout hand-off; no optimistic VIP mutation |
| Upgrade consumer       | Diagnostic log, then `EconomyStore.upgradeVip('consumer')`                                | Same checkout boundary                                 |
| Generate key           | `EconomyStore.generateApiKey()`, then success log                                         | Store remains API-key owner                            |
| Execute PostGIS        | Diagnostic log, `DiscoveryService.findPartners(params)`, results signal, success/warn log | Existing request shape and error boundary              |
| Toggle Centrifugo      | `connect()` or `disconnect()`, then diagnostic log                                        | `CentrifugeService` remains connection owner           |
| Simulate Redis fan-out | Diagnostic log only                                                                       | Keep local simulation semantics                        |
| Raise hand             | Local role/publish signals, diagnostic log                                                | Keep simulation local                                  |
| Demote                 | Local role/publish signals, diagnostic log                                                | Keep simulation local                                  |
| Toggle recording       | Local recording signal, diagnostic log                                                    | Keep simulation local                                  |

There are no component-owned Router calls, dialogs, external navigation links or product analytics events to preserve.

## Migration risks

### 1. Tab replacement changes state semantics

Replacing the four buttons with Tabs must not change the default Overview selection or unexpectedly clear form/search/simulation state when switching sections.

### 2. Async double submission

Checkout, API-key generation, Centrifugo connection and diagnostic writes can be triggered without component-level pending guards. A visual migration can expose latent duplicate-request behaviour if controls are restructured.

### 3. Accessible-name drift

The execute, Centrifugo and recording controls currently demonstrate visible/action-label drift. Copying those bindings into a new wrapper would preserve an accessibility bug.

### 4. PostGIS empty-state ambiguity

`discoveryResults = []` currently means both "not searched" and "searched with zero results". Tests should establish the intended distinction before presentation is changed.

### 5. VIP-spoof control is not query input

The checkbox currently affects diagnostic text only. Do not assume it belongs in the `findPartners()` request.

### 6. API-key exposure

The full generated key is rendered in the DOM. Refactoring must not add accidental duplication, persistence, logging or analytics capture of that value.

### 7. Diagnostic data exposure

Logs can contain current-user identifiers and low-level infrastructure details. Keep them inside the developer diagnostic boundary and do not add third-party telemetry.

### 8. Resource loading is invisible

`dashboardData` performs two async loads but the template does not expose resource pending/error state. Introducing a loader must not hide already-valid cached store data unnecessarily.

### 9. No colocated regression suite

There is no component spec beside the three implementation files. Behavioural migration without tests would be high risk because the dashboard has many independent service and signal transitions.

### 10. Simulation versus production behaviour

Redis and LiveKit controls are deliberate developer simulations. Moving them into generic primitives must not turn mock transitions into real production mutations.

## Required regression coverage

Before or alongside the implementation migration, add a focused `developer-dashboard.component.spec.ts` with fakes/mocks for the injected services and store.

At minimum cover:

1. Overview is selected by default.
2. Tab selection changes the visible panel while preserving unrelated local state.
3. Tab keyboard semantics follow the chosen Spartan primitive.
4. Developer and consumer upgrade actions call the expected tier exactly once per activation.
5. API-key generation delegates to the store and does not place the generated key in diagnostics.
6. Latitude, longitude and radius values produce the current `SearchFilterParams` request shape.
7. `spoofVipLocation` does not silently alter the request shape unless a separate product change approves it.
8. PostGIS disables/rejects duplicate execution while searching.
9. Successful zero-result search is distinguishable from untouched state after migration.
10. PostGIS failure ends pending state and exposes the chosen error treatment.
11. Centrifugo connect/disconnect follows service truth and uses the correct action label for each state.
12. Redis simulation creates only the intended diagnostic action.
13. Raise Hand and Demote produce the current role/can-publish transitions.
14. Recording toggle preserves current local state transitions and state-dependent accessible name.
15. Diagnostic empty/populated states render without leaking extra data.
16. Bootstrap pending/failure behaviour is deterministic if surfaced.
17. All interactive controls are keyboard reachable with visible focus.
18. RTL rendering uses logical layout and preserves readable coordinates/identifiers.
19. Long translated strings reflow at narrow widths and high zoom.
20. Light and dark themes retain semantic contrast.

Tests must use stable user-facing behaviour and accessible queries rather than Tailwind class names where possible.

## Recommended implementation sequence

1. Add the focused component regression suite around current side effects and state transitions.
2. Verify the repository's exact Spartan Tabs capability and migrate the sandbox navigation to it.
3. Correct state-dependent accessible names for search, Centrifugo and recording actions.
4. Introduce explicit untouched/searching/results/empty/error PostGIS presentation without changing request semantics.
5. Add bounded pending/error treatment to other async actions where the service/store contract supports it.
6. Decide and document diagnostic-log translation policy.
7. Run RTL, long-translation, keyboard, zoom, light-theme and dark-theme checks.
8. Update design-preview artefacts only if a mapped visual contract actually changes.

Keep each stage behaviour-preserving except where this audit identifies a specific accessibility or state-model defect that is intentionally corrected.

## Verification commands for the implementation stage

Run the repository's actual frontend checks after code changes:

```bash
cd frontend
npm run check:control-flow
npm run check:rtl-logical
npm run test -- --watch=false
npm run build
```

Run frontend lint if the current package exposes it.

From the repository root, run design-sync validation when a mapped visual contract changes:

```bash
npm run check:design-sync
```

Also run any component-specific tests introduced by the migration.

## Acceptance mapping

This audit satisfies the issue objective by providing:

- a complete inventory of current controls, state and side effects;
- explicit Spartan Brain / Spartan Helm / Relay ownership decisions;
- preservation requirements for `/developer`, checkout, API-key, discovery, Centrifugo, Redis, LiveKit and diagnostics behaviour;
- identified accessibility, translation, RTL, theme, async-state and data-exposure risks;
- concrete prerequisites and migration sequencing;
- an implementation-ready regression matrix.

No runtime, route or visual behaviour is changed by this audit.
