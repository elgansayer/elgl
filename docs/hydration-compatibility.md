# Hydration Compatibility Standard

Status: architecture standard for issue #5527.

This document defines the canonical Angular hydration contract for the Relay + Spartan frontend. It
is intentionally narrower than the general SSR contract: SSR decides whether and how a route is
rendered on the server; hydration decides whether the browser can safely reuse that server-rendered
DOM without structural mismatch, duplicated work, lost interaction, or visual state drift.

The runtime Angular application, Relay semantic tokens, Spartan Helm/Brain behaviour, and automated
tests remain authoritative. Claude Design records visual intent, not hydration mechanics.

## Goals

Every server-rendered route must satisfy all of the following:

- the server DOM and the client's first render describe the same semantic structure;
- Angular can reconcile and reuse the server DOM instead of destroying and rebuilding it;
- browser-only capabilities do not run during server rendering;
- browser-only state does not alter the hydrated structure before Angular has reconciled it;
- user interaction performed before a deferred area hydrates is not silently lost;
- light/dark themes, per-user primary accents, RTL, translations and accessibility relationships
  remain stable across the server-to-client boundary;
- shared data is transferred or cached rather than fetched once on the server and immediately again
  on the browser without need;
- authentication, private data and device-specific state never leak into cacheable server HTML;
- hydration work never requires a second feature implementation or a second design-system layer.

## Non-goals

This standard does not:

- require every route to use server rendering;
- move device, media-call or browser-only flows away from their explicit client render mode;
- replace Angular's hydration engine with custom DOM reconciliation;
- introduce a Relay hydration primitive;
- fork Spartan Brain or Helm to make them hydration-aware;
- require browser state such as `localStorage` to exist on the server;
- make Claude Design responsible for runtime hydration state.

## Current implementation audit

### Application bootstrap

The frontend currently uses Angular's application builder with both browser and server entrypoints and
`outputMode: "server"` in `frontend/angular.json`.

Shared providers in `frontend/src/app/app.config.ts` include `provideClientHydration()`. The same
shared application configuration is merged into the server configuration in
`frontend/src/app/app.config.server.ts`, which then adds `provideServerRendering(...)`. This is the
correct ownership shape: hydration is configured once in the shared bootstrap path that is used by
both browser and server.

`provideClientHydration()` is the canonical hydration provider. Do not create an application-local
wrapper around Angular's DOM reconciliation.

### Server route ownership

`frontend/src/app/app.routes.server.ts` currently server-renders by default and deliberately keeps
browser/device-heavy surfaces in `RenderMode.Client`, including active calls, video calls, audio
rooms and device transfer. That split is valid. A client-only route is not a hydration failure: it is
an explicit rendering policy decision.

A new `RenderMode.Client` exception must therefore be justified by a genuine browser-only product
boundary, not by a component that happens to contain hydration bugs.

### Browser-capability access

The bootstrap path already contains examples of the preferred capability boundary:

- server configuration loading is skipped on the server;
- deep-link initialisation reads the browser through injected `DOCUMENT` and `defaultView`;
- protocol-handler registration is best-effort and capability-checked.

`ThemeService` also guards storage, `window`, `document` and `matchMedia` access. These guards keep
SSR from crashing, but crash-safety alone is not enough for hydration: any browser-derived value that
changes rendered DOM before reconciliation can still create a mismatch or visible drift.

### Relay and theme state

Relay colour, surface, spacing, radius and shadow roles are CSS/token concerns. Hydration must not
fork the DOM by theme. Light/dark and the per-user primary accent should change CSS variables/classes
or stable attributes, not choose different component trees.

A server render may not know a preference stored only in browser storage. In that case the server
must render a deterministic baseline and the browser may enhance presentation after the hydration
boundary. If a preference must affect the first HTML response, promote it to a server-readable,
privacy-reviewed source such as a request cookie or authenticated server state instead of guessing.

### Spartan interaction ownership

Spartan Brain owns interaction state such as dialog focus, radio selection semantics, menus,
comboboxes and other composite controls. Feature code must not pre-emptively manipulate their DOM to
"prepare" hydration. Closed overlays should remain closed on both server and initial client render
unless their open state is derived from deterministic server-visible route/data state.

### Known risk classes

The repository is large and still contains browser-oriented code. The highest hydration risks are:

1. direct DOM mutation during construction or initial render;
2. `window`, `document`, storage, media-query, observer, canvas or media-device reads that change
   template structure on the first client pass;
3. IDs generated from randomness, wall-clock time or process-local counters;
4. `Date.now()`, `new Date()`, `Math.random()` or locale/environment-dependent values directly in
   server-rendered templates;
5. client-only asynchronous data replacing server-rendered data before Angular has reconciled it;
6. invalid HTML that browsers normalise differently from Angular's server serializer;
7. third-party widgets that create/move nodes outside Angular before hydration completes;
8. broad use of `ngSkipHydration` to hide instead of fix those problems.

## Canonical ownership model

### Feature code owns product state

Feature components own product data and user intent, expressed through signals, `computed()`,
`resource()` and standard Angular template control flow. They do not own DOM reconciliation.

A feature may decide that a capability is unavailable on the server, but it must express that as a
stable product state rather than by reading a browser global inside its template.

### Angular owns hydration

Angular owns:

- server DOM annotations;
- DOM reconciliation;
- HTTP transfer caching supplied by the hydration provider;
- incremental hydration behaviour supplied by the Angular version in use;
- event replay where enabled by Angular hydration features;
- hydration error reporting.

Do not remove Angular's server comment/anchor nodes in an application transform, CDN optimisation or
post-processing step.

### Relay owns visual tokens

Relay owns semantic colour, typography, spacing, radius, elevation and responsive tokens. Hydration
must preserve their semantic names. A component must not render one set of classes on the server and
a structurally different markup tree in dark mode on the browser.

### Spartan owns interaction primitives

Spartan Helm and Brain own supported interactive semantics and overlay behaviour. Hydration-specific
feature code must not fork, clone or replace those primitives.

### Claude Design owns design intent

A hydration-only change that preserves visual contract does not require design-preview changes. A
change that alters a mapped visible state still follows `docs/claude-design-two-way-sync.md` and the
normal design-sync manifest rules.

## Deterministic first-render contract

For every server-rendered component, the server render and the browser's first render must agree on:

- element order and nesting;
- Angular control-flow branches;
- text nodes that participate in the initial DOM;
- projected-content structure;
- form-control type and basic state;
- IDs and every `for`, `aria-labelledby`, `aria-describedby`, `aria-controls` and related IDREF;
- whether an overlay or conditional region exists;
- list item identity and order;
- visible loading, empty, unavailable and content states;
- locale and direction when they are server-known inputs.

Values that are inherently browser-only should not decide any of those before hydration.

## Stable state sources

Use the following preference order for initial render state:

1. route parameters and URL state that are available to both server and browser;
2. server-fetched API data transferred through Angular's supported hydration/HTTP mechanisms;
3. deterministic application defaults;
4. browser-only enhancement after the hydration-sensitive first render.

Never use an uncoordinated browser read as the first-render source of truth when the server rendered a
different value.

## HTTP and data transfer

`provideClientHydration()` supplies Angular's supported HTTP transfer behaviour. Prefer normal
`HttpClient` requests through the NestJS API and allow Angular to reuse eligible server responses on
the browser.

Rules:

- do not add a parallel hand-written response cache merely for hydration;
- do not put authentication tokens, private chat content, precise location, private profile fields,
  payment data or other sensitive response bodies into broadly reusable HTML caches;
- authenticated pages must keep cache policy user-scoped or non-cacheable as appropriate;
- a `resource()` loader must tolerate server execution only when its dependencies are server-safe;
- if a request is intentionally browser-only, model that boundary explicitly rather than allowing a
  server exception and retrying silently on the client;
- do not make server and browser issue different query parameters merely because the platform differs;
- preserve API-first architecture: Angular does not query Supabase directly during SSR or hydration.

## Browser-only APIs

Browser-only APIs include, but are not limited to:

- `window` and browser-only members of `document`;
- `localStorage` and `sessionStorage`;
- `navigator`, geolocation, clipboard, share, protocol handlers and media devices;
- `matchMedia`;
- `ResizeObserver`, `IntersectionObserver` and `MutationObserver`;
- canvas/WebGL/WebAudio APIs;
- `Audio`, `MediaRecorder`, `RTCPeerConnection`, LiveKit browser connections and other realtime media
  clients;
- Cache Storage and IndexedDB.

The preferred access pattern is capability-based:

```ts
const document = inject(DOCUMENT);
const browser = document.defaultView;

if (!browser) {
  return;
}
```

Use `PLATFORM_ID` / `isPlatformBrowser()` or `isPlatformServer()` when the platform itself is the
meaningful branch. Prefer injected/document-derived capabilities over scattered direct global reads
because they are easier to test and reason about.

A platform guard must wrap the operation, not merely the assignment. This is wrong:

```ts
const width = window.innerWidth;
if (isPlatformBrowser(platformId)) {
  // too late
}
```

## Render-time DOM mutation

Do not mutate nodes that Angular is about to hydrate.

Prohibited during initial render:

- `element.innerHTML = ...` or `outerHTML = ...`;
- `appendChild`, `insertBefore`, `removeChild` or node replacement used to construct Angular UI;
- moving Angular-owned nodes between containers;
- creating projectable nodes with native DOM APIs;
- third-party initialisers that rewrite a component's server-rendered children before reconciliation.

Prefer Angular templates, bindings, directives and supported programmatic component APIs.

When a non-Angular library genuinely requires DOM access, initialise it in a browser-only render
callback and isolate its owned DOM below a stable Angular host. `afterNextRender()` or the appropriate
render callback may be used for browser-only setup, but it is not permission to rewrite
Angular-owned hydrated nodes. Angular does not guarantee that an arbitrary child is already hydrated
when a render callback runs, so keep writes confined to DOM explicitly owned by the third-party
integration.

## `ngSkipHydration` policy

`ngSkipHydration` is a last-resort migration tool, not a normal component option.

It is permitted only when all of these are true:

- a third-party DOM integration cannot be made hydration-compatible in the current change;
- the skip is placed on the smallest component host that owns the incompatible subtree;
- accessibility and functionality remain correct when Angular re-renders that subtree;
- the skipped subtree does not contain a critical above-the-fold layout whose replacement would cause
  material layout shift;
- the reason and removal plan are documented in code or the tracking issue;
- the change includes regression coverage around the skipped boundary.

Never put `ngSkipHydration` on the application shell, page shell, router outlet or a broad shared Relay
primitive merely to make hydration errors disappear.

## IDs and accessible relationships

Hydration requires instance-stable accessible relationships.

Do not generate server-rendered IDs from:

- `Math.random()`;
- `Date.now()`;
- browser-only counters;
- process-local values whose sequence can differ between server and browser.

Prefer:

- direct label/control composition that needs no ID;
- Spartan/Angular primitive-generated IDs when documented as hydration-stable;
- deterministic IDs derived from stable entity identity plus an instance-safe scope;
- framework-provided unique IDs only when they are documented for SSR/hydration.

The server and browser must agree on the same `id`, `for`, `aria-labelledby`, `aria-describedby`,
`aria-controls` and live-region relationships.

## Collections and list identity

`@for` blocks must track stable application identity. Do not track by an order that can differ after a
client refetch.

Server and browser must not independently shuffle or randomise an initially hydrated list. If a
recommendation order is server-owned, transfer and reuse that order for the initial client render.
Later refreshes may change it through normal Angular rendering after hydration.

## Time, randomness and locale

Do not put nondeterministic values directly into hydrated templates.

Bad examples:

```ts
readonly greeting = new Date().getHours() < 12 ? 'morning' : 'afternoon';
readonly decorativeId = Math.random().toString(36);
```

Safer patterns:

- calculate a server-owned timestamp in the API and render that same value on both sides;
- use a deterministic state snapshot transferred from the server;
- defer purely decorative browser-only randomness until after initial hydration;
- format dates/numbers using the same explicit locale/timezone inputs on server and browser when the
  formatted string participates in initial HTML;
- render stable ISO data first when the browser timezone is intentionally the source of truth, then
  enhance the displayed formatting after the hydration-sensitive boundary if necessary.

Never infer a private timezone, location or profile preference on the server from unrelated request
metadata merely to make the markup match.

## Theme and per-user accent compatibility

Theme parity is mandatory, but hydration may not depend on guessing browser-only storage.

Rules:

- template structure is theme-independent;
- Relay semantic classes are identical across light and dark mode;
- the `.dark` root class and primary accent variables may change presentation without changing the
  component tree;
- if theme/accent is only stored in browser storage, render a deterministic baseline on the server;
- do not branch `@if (isDarkMode)` into different server/client component trees;
- do not flash private profile data into public server HTML just to recover an accent preference;
- when server-visible preference propagation is introduced, it must be authenticated or cookie-based,
  narrowly scoped, validated, and covered by cache/privacy rules.

A hydration test must cover both light and dark visual states for representative mapped screens, but
that does not mean duplicating the HTML per theme.

## RTL and localisation compatibility

Language and direction are part of hydration state when they affect initial text or attributes.

Rules:

- use the repository's canonical locale metadata and `dir` policy;
- use logical Tailwind properties so the DOM does not need a structural RTL fork;
- do not choose between separate LTR and RTL templates;
- ensure translated loading/empty/error text is available through the same deterministic translation
  source during the initial render;
- if a locale is browser-only at first request, render the documented deterministic default and switch
  locale through normal client rendering after hydration, or promote the locale preference to a
  server-visible state in a dedicated change;
- preserve first-class CJK, Arabic, Devanagari and other complex-script shaping through the existing
  system font and language-boundary contracts;
- never use hydration mismatch suppression as an i18n strategy.

## Forms

Server-rendered forms must start with the same control structure and initial values on both sides.

- prefer Signal Forms for new work as required by frontend conventions;
- never read a stored draft in the browser and insert/remove fields before hydration;
- browser-only draft restoration should happen after the deterministic first render;
- server-owned validation errors may render on the first response only when the browser hydrates the
  same error state;
- generated IDs and description/error relationships must be stable;
- password, token, payment and other sensitive values must never be serialized into server HTML for
  hydration convenience.

## Overlays, dialogs, menus and popovers

Spartan owns overlay interaction mechanics.

The initial server/client state for an overlay must agree. A route-driven modal may render open on
both sides when its state is deterministic. A locally opened dialog should normally render closed on
both sides and open only in response to a hydrated/replayed user action.

Do not:

- create a second feature-owned focus trap for SSR;
- pre-create portal DOM with native APIs before hydration;
- render an overlay open only because `window` or storage exists;
- use random IDs to connect trigger and overlay;
- disable Escape/focus behaviour in server-rendered routes.

## Service workers and offline state

Service workers, Cache Storage and IndexedDB are browser-only enhancement layers. They must not alter
the server-rendered structure before hydration.

Cached API data may be used after the client takes ownership, but it must not replace fresh
server-rendered user-specific content before reconciliation. Offline fallback routes should have a
separate explicit contract and must not fabricate authenticated/private content.

## Realtime state

Centrifugo and LiveKit are browser/realtime concerns. The server may render a deterministic snapshot,
but websocket/media subscriptions start only on the browser.

Realtime events that arrive during or immediately after bootstrap must reconcile through the same
signal/store pathway as later events. Do not directly append DOM nodes or maintain a second
"pre-hydration" message list.

For chat, notifications, presence and other private streams:

- do not serialize connection tokens into reusable HTML;
- connect only after authenticated browser state is available;
- deduplicate incoming events against the server-rendered snapshot using stable IDs;
- do not let an early realtime update regress server-authoritative status such as read receipts.

## Error and unavailable states

Provider failure must not create a server/client structural mismatch.

A server-rendered unavailable/error state should hydrate as that same state. The browser may retry
after hydration through the normal component resource/store. Do not convert a failed server request
into fake successful placeholder data solely to keep markup stable.

If an error is intentionally browser-only, the deterministic server state should remain meaningful
and accessible until the browser owns the interaction.

## Security and privacy

Hydration is a serialization boundary. Anything embedded in server HTML is delivered to the browser
before application JavaScript executes.

Never serialize into public or shared-cache HTML:

- access, refresh, Centrifugo, LiveKit or provider tokens;
- private message or notification payloads outside an authenticated, non-cacheable response contract;
- precise location or hidden profile data;
- payment secrets or webhook data;
- unneeded internal IDs;
- browser storage contents.

Do not solve hydration by mirroring all client storage into cookies. Only promote a preference to a
server-readable cookie when the product requires it, the value is non-sensitive, validation is
strict, scope/expiry are limited, and cache variation is explicit.

## Performance and stability

Hydration exists to reuse server work and reduce layout/re-render cost. New code should not erase that
benefit.

- keep server/client first-render trees compact and equivalent;
- avoid duplicate server and browser data fetches when Angular transfer caching applies;
- do not run expensive third-party DOM initialisers before needed;
- prefer lazy standalone routes and `@defer` for genuinely non-critical work;
- treat application instability that indefinitely delays hydration as a production defect;
- do not leave development-only hydration/stability instrumentation enabled in production bundles;
- measure CLS/LCP when a migration changes above-the-fold rendering.

## Accessibility contract

Hydration must not create a period where accessibility relationships are incorrect.

Representative verification must cover:

- accessible name and description relationships remaining stable;
- deterministic focus order after hydration;
- keyboard activation of native and Spartan controls;
- dialog focus return and Escape behaviour after hydration;
- live regions not announcing duplicate server and browser content;
- no duplicate IDs after client ownership;
- RTL and translated labels;
- light/dark themes and per-user accent semantics;
- 200% and 400% zoom/reflow where the mapped visual contract requires them.

Event replay does not replace correct keyboard semantics. Native controls and Spartan Brain behaviour
remain the primary interaction contract.

## Migration examples

### Example: browser width

Do not render different initial structures from `window.innerWidth`:

```ts
// Prohibited for initial server-rendered structure.
readonly compact = signal(window.innerWidth < 768);
```

Use mobile-first CSS and Relay responsive breakpoints so both server and browser render the same DOM:

```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  ...
</div>
```

### Example: local storage preference

Do not use a storage value to add/remove initial nodes before hydration:

```ts
// Prohibited when it changes hydrated structure.
readonly showTips = signal(localStorage.getItem('showTips') !== 'false');
```

Render a deterministic default. Restore the browser preference after the hydration-sensitive first
render, or move the preference to an intentional server-visible contract if first-response accuracy is
required.

### Example: third-party DOM library

Do not initialise a library in the constructor when it rewrites Angular-owned DOM:

```ts
// Prohibited.
constructor() {
  new Widget(document.querySelector('#widget'));
}
```

Give the integration a stable host and initialise browser-side after rendering, keeping the library's
mutations inside its own host subtree.

### Example: IDs

Do not create accessible IDs with randomness:

```ts
// Prohibited.
readonly descriptionId = `description-${Math.random()}`;
```

Prefer direct semantic composition or a documented deterministic/framework SSR-safe ID mechanism.

### Example: route exception

Do not switch an ordinary settings route to `RenderMode.Client` because one child reads storage.
Fix or isolate that child. Reserve client render mode for routes whose core product contract requires
browser-only capabilities, such as active realtime media/device flows.

## Prohibited patterns

The following are hydration architecture violations unless a narrowly documented exception applies:

- separate server and browser component templates for the same ordinary UI;
- platform branches that change initial structural markup;
- direct browser global reads in field initialisers used by server-rendered components;
- native DOM mutation of Angular-owned nodes before hydration;
- `innerHTML`/`outerHTML` used to construct product UI;
- random/time-dependent IDs or initial list ordering;
- first-render branching on viewport width instead of responsive CSS;
- first-render branching on browser-only theme/storage state;
- broad `ngSkipHydration` on page/application shells;
- using `RenderMode.Client` as a generic hydration workaround;
- deleting Angular comment/anchor nodes from server HTML;
- duplicating HTTP caches outside Angular only to suppress browser refetches;
- serializing secrets/private state solely to make client markup match;
- feature-owned replacements for Spartan interaction behaviour during hydration;
- different LTR and RTL component trees;
- fake success data used to mask server/client state disagreement.

## Reviewed exceptions

An exception must document:

1. why the server/client structures cannot currently be made equivalent;
2. why a normal Angular template or browser-capability guard is insufficient;
3. the smallest affected component/route;
4. privacy and cache implications;
5. accessibility and layout-shift impact;
6. automated regression coverage;
7. owner/tracking issue and removal condition.

Prefer a narrow `RenderMode.Client` route for a fundamentally browser-only product over many scattered
hydration skips. Prefer a narrow `ngSkipHydration` component for an unavoidable third-party DOM widget
over disabling hydration for its page.

## Verification contract for follow-up #5528

The follow-up hydration migration gate should be small, deterministic and useful on every pull request.
It should not require production credentials.

At minimum it should verify:

### Structural configuration

- `frontend/angular.json` still has browser/server entrypoints and server output;
- shared bootstrap still provides `provideClientHydration()`;
- server bootstrap still merges shared config and provides server rendering;
- default server route policy remains intentional and browser-only exceptions remain explicit.

### Source-level guard

For changed frontend production files, reject newly introduced high-risk patterns where a safe
mechanical check is possible, including:

- unguarded direct `window`/`document`/storage access in render-time field initialisers;
- `Math.random()`/`Date.now()` used to generate template IDs;
- new broad `ngSkipHydration` without an allowlisted reviewed exception;
- new `innerHTML`/`outerHTML` or native DOM tree mutation in Angular components;
- route changes that switch server-rendered pages to `RenderMode.Client` without an explicit reviewed
  exception marker.

The guard must compare against base-branch debt so unrelated migration work is not blocked by historic
violations.

### Render smoke test

Run the production server build and exercise at least one representative public/server-safe route.
The browser smoke test should fail on Angular hydration errors such as node mismatches, invalid
hydration structure or missing server hydration annotations.

Representative coverage should include:

- light theme;
- dark theme;
- RTL locale/direction;
- keyboard interaction on at least one native/Spartan control;
- a route that performs normal API/translation bootstrapping without production credentials by using
  test-safe fixtures/mocks.

### Expected failure modes

The gate should print actionable messages such as:

```text
Hydration contract failed: provideClientHydration() is missing from shared application providers.
Hydration contract failed: new broad ngSkipHydration usage requires a reviewed exception.
Hydration contract failed: client hydration reported NG0500 on /<representative-route>.
Hydration contract failed: server-rendered route was changed to RenderMode.Client without an exception.
```

Do not add a brittle grep rule that rejects every mention of `window` or `document`. Capability-guarded
browser integrations are legitimate. The guard should target only high-confidence migration regressions
and let unit/browser tests cover behavioural cases.

## Verification commands

Architecture-only changes to this document should run the normal repository/frontend gates through CI.
For implementation changes affecting hydration, the expected local baseline is:

```bash
cd frontend
npm run lint
npm run check:control-flow
npm run check:rtl-logical
npm run build
npm test -- --watch=false
cd ..
npm run check:design-sync
```

When #5528 lands, its hydration-specific command becomes mandatory for changed server-rendered frontend
code.

## Definition of done for hydration-sensitive UI

A hydration-sensitive change is complete only when:

- the route's render mode is still correct;
- server and browser first-render structure is deterministic;
- browser APIs are capability-guarded;
- direct DOM mutation is absent or narrowly isolated;
- IDs and accessibility relationships are stable;
- data fetching does not create avoidable duplicate server/browser work;
- no private data is serialized outside its intended authenticated/cache boundary;
- light/dark, accent, RTL and translated states remain semantically equivalent;
- keyboard/focus behaviour still comes from native controls or Spartan where applicable;
- high zoom/reflow remains valid when the visual contract requires it;
- relevant unit/build/hydration verification is green;
- any `ngSkipHydration` or client-only exception is documented and narrowly scoped.

## Rollout and rollback

This standard changes architecture guidance only and has no runtime rollout dependency.

Implementation migrations should land incrementally by feature/component. If a hydration migration
causes a production regression, revert the scoped component change first. Do not globally disable
hydration as the default rollback. If a browser-only third-party integration is the root cause, a
narrow reviewed `ngSkipHydration` or explicit client-render exception may be used temporarily while the
root incompatibility is fixed.

## References

- Angular hydration guide: <https://angular.dev/guide/hydration>
- Angular `provideClientHydration`: <https://angular.dev/api/platform-browser/provideClientHydration>
- Angular incremental hydration: <https://angular.dev/guide/incremental-hydration>
- Angular hydration mismatch guidance: <https://angular.dev/errors/NG0500>
- Repository design system: `DESIGN.md`
- Frontend engineering rules: `frontend/AGENTS.md`
- Spartan/Relay ownership: `docs/spartan-relay-architecture.md`
- Claude Design sync: `docs/claude-design-two-way-sync.md`
