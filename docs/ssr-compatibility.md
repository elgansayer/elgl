# SSR compatibility

Status: authoritative implementation contract for the Relay + Spartan UI migration.

Issue: #5525

This document defines the repository-wide Server-Side Rendering (SSR) compatibility contract for the Angular application. It supplements `DESIGN.md`, `AGENTS.md`, `docs/spartan-relay-architecture.md`, and the responsive/accessibility standards. It does not introduce a second component system, a second routing system, or a feature-specific rendering framework.

## 1. Scope

The contract applies to:

- Angular routes and route guards;
- standalone components and lazy-loaded feature surfaces;
- Relay primitives and Spartan Helm compositions;
- application initializers and global providers;
- services that touch browser APIs;
- authentication and user preference state;
- translations, theme state, primary accent state, and RTL direction;
- dialogs, sheets, menus, popovers, tooltips, and other overlays;
- media, canvas, audio/video call, notification, service-worker, and device APIs;
- server-rendered loading, empty, unavailable, unauthorized, and error states;
- hydration and the transition from server HTML to the interactive browser application.

SSR compatibility is a correctness requirement. A feature is not compatible merely because TypeScript compiles. Server rendering must not throw, disclose private browser-only state, produce contradictory markup, or hydrate into a materially different semantic structure.

## 2. Current implementation audit

The repository already has an Angular SSR foundation:

- `frontend/angular.json` uses the Angular application builder with `src/main.ts` for the browser, `src/main.server.ts` for the server, `outputMode: "server"`, and `server.ts` as the SSR entry.
- `src/main.server.ts` bootstraps the same standalone `AppComponent` used by the browser.
- `app.config.server.ts` merges the shared application configuration with `provideServerRendering(...)`.
- `app.routes.server.ts` makes server rendering the default and deliberately marks device-heavy routes such as active calls, video calls, audio rooms, and device transfer as `RenderMode.Client`.
- `app.config.ts` enables `provideClientHydration()`.
- the configuration initializer skips browser configuration loading when `isPlatformServer(...)` is true.
- deep-link initialization reads browser state through injected `DOCUMENT` and its optional `defaultView`, rather than dereferencing global `window` unconditionally.
- existing services already demonstrate `isPlatformBrowser(...)`, `isPlatformServer(...)`, and browser-safe wrappers where browser capabilities are genuinely required.

This direction is correct. The migration must preserve one shared Angular application and make browser-only behavior explicit at capability boundaries.

### 2.1 Current migration risks

The codebase also contains browser-dependent capabilities such as:

- `localStorage` and `sessionStorage`;
- `window`, `document`, `navigator`, and location APIs;
- media playback and recording;
- canvas and image processing;
- WebRTC, LiveKit, and device permissions;
- service workers and push notifications;
- protocol-handler registration;
- clipboard, vibration, geolocation, WebAuthn, and other browser APIs;
- DOM measurements, `ResizeObserver`, `IntersectionObserver`, and pointer APIs.

These capabilities are valid in the browser. The risk is allowing them to execute during module evaluation, service construction, initial signal computation, route resolution, or server template rendering without a platform/capability boundary.

The migration must also avoid a second class of SSR bugs: server markup that renders one theme, direction, authorization state, or control tree and is immediately replaced by a different browser tree during hydration.

## 3. Canonical ownership model

SSR responsibilities follow the existing architecture layers.

### 3.1 Angular application layer

Angular owns:

- server and browser bootstrapping;
- route render modes;
- dependency-injection platform identifiers;
- hydration;
- `DOCUMENT` abstraction;
- server request/render context;
- transfer/hydration mechanisms when genuinely required.

Feature code must not invent its own SSR runtime.

### 3.2 Spartan Brain and Helm

Spartan owns generic interaction mechanics for approved primitives, including focus management, selection state, dialog/menu semantics, and keyboard behavior.

Feature code must not fork a Spartan primitive into separate server and browser templates merely because the interactive behavior activates only after hydration. The server should render the same semantic primitive structure whenever the primitive itself is server compatible.

### 3.3 Relay

Relay owns reusable product presentation:

- semantic surfaces and borders;
- typography;
- radius and elevation;
- spacing and responsive composition defaults;
- theme roles;
- dynamic primary-accent roles;
- reusable product-level component shells.

SSR must not create a server-only visual token layer. Light/dark and accent roles remain Relay responsibilities on both server and browser.

### 3.4 Feature code

Feature code owns product-specific data and composition. It may:

- choose a route to be client-rendered when the route fundamentally requires a browser/device capability;
- defer a browser-only enhancement until after render;
- render a truthful unavailable/loading state on the server when authoritative private data is unavailable there;
- call browser capability adapters only after confirming the capability is available.

Feature code must not use `typeof window !== 'undefined'` repeatedly throughout templates and business logic when a shared service or Angular platform boundary can own the distinction.

## 4. Render-mode contract

Server rendering is the default. Client-only rendering is an exception.

A route should remain server-rendered when its initial shell, public content, loading state, or non-device-dependent content can be rendered meaningfully on the server.

A route may use `RenderMode.Client` when its primary purpose fundamentally requires browser-only state that cannot produce a useful or privacy-safe server representation. Existing examples include:

- active audio/video call surfaces;
- device transfer;
- audio-room routes whose core runtime depends on live browser media/device state.

Do not mark an entire route client-only merely because one button uses the clipboard, one child component uses canvas, or one enhancement reads local storage. Keep the route server-renderable and isolate the browser-only capability.

Any new `RenderMode.Client` entry must document why a smaller capability boundary is insufficient.

## 5. Browser API contract

### 5.1 No browser globals during module evaluation

Prohibited:

```ts
const savedTheme = localStorage.getItem('theme');
const viewport = window.innerWidth;
```

at module scope.

Module evaluation runs in both server and browser bundles. Browser state must be read lazily behind an explicit boundary.

### 5.2 Prefer Angular platform and document abstractions

For platform checks:

```ts
private readonly platformId = inject(PLATFORM_ID);

readBrowserPreference(): string | null {
  if (!isPlatformBrowser(this.platformId)) return null;
  return localStorage.getItem('preference');
}
```

For DOM/window access, prefer injected `DOCUMENT`:

```ts
private readonly document = inject(DOCUMENT);

openExternal(url: string): void {
  this.document.defaultView?.open(url, '_blank', 'noopener');
}
```

Optional chaining is not a substitute for authorization or URL validation. It only protects capability absence.

### 5.3 Render-phase browser work

DOM measurement, focus placement, canvas initialization, observer registration, and similar work should run after browser rendering, using Angular lifecycle/render APIs such as `afterNextRender(...)` where appropriate.

Do not use a constructor to measure DOM or start a media/device operation.

### 5.4 Capability adapters

Repeated browser capabilities should be centralized behind services or existing adapters. Examples include:

- storage;
- geolocation;
- clipboard;
- media/device permissions;
- notifications;
- haptics/vibration;
- viewport/observer behavior.

The feature consumes a truthful capability result. It should not scatter browser detection through unrelated product logic.

## 6. Storage and persisted preference contract

`localStorage` and `sessionStorage` are browser-only, optional capabilities. They can be unavailable even in a browser because of privacy settings, quota exhaustion, sandboxing, or browser policy.

SSR-safe storage behavior must therefore:

1. avoid storage access on the server;
2. tolerate browser read/write exceptions;
3. maintain an in-memory truthful state when persistence is unavailable;
4. never represent a failed write as successful durable persistence;
5. avoid rendering private stored values into server HTML.

Theme, language, draft, cache, and similar services should expose a stable application API rather than making feature components access web storage directly.

## 7. Authentication and private data

SSR must not fabricate an authenticated browser identity.

The server may render:

- a public state;
- an anonymous shell;
- a loading/unknown state;
- authenticated content only when the server request has an authoritative authenticated context designed for SSR.

The browser may subsequently establish a Supabase session, but hydration must not depend on a fake server-side user or mock token.

Do not serialize access tokens, refresh tokens, provider credentials, or other secrets into rendered HTML or transfer state.

If server and browser authentication knowledge differs, choose markup that can transition without exposing private data or producing contradictory interactive controls.

## 8. HTTP and configuration

The shared application uses Angular `HttpClient` with `withFetch()`, which is compatible with server rendering.

Rules:

- configuration required only by the browser may be deferred on the server, as the existing `ConfigurationService` initializer does;
- server-rendered HTTP calls must use a URL and credential model explicitly supported in the SSR environment;
- never assume `localhost` means the same service from every deployment container;
- do not silently convert an SSR provider/network failure into fictional successful data;
- bounded, truthful loading/unavailable states are preferable to mock fallback content.

When a request should only occur after hydration, guard it at the service/feature boundary rather than allowing server errors and swallowing them globally.

## 9. Hydration stability

The server-rendered accessibility tree and the first browser render must be structurally compatible.

Avoid:

```html
@if (isBrowser) {
  <button>...</button>
} @else {
  <div>...</div>
}
```

when both nodes represent the same product control.

Prefer rendering the stable semantic shell on both platforms and activating browser-only behavior after hydration.

Hydration-sensitive values include:

- random IDs generated independently on server and browser;
- current timestamps used directly in initial markup;
- `Math.random()`;
- viewport width or media-query state;
- storage-backed preferences;
- browser locale data that differs from the server locale;
- authorization state not known to both platforms.

Use stable inputs, Angular-generated identity, request-derived state, CSS responsiveness, or a deliberate post-hydration enhancement instead.

## 10. Theme, primary accent, and direction

SSR compatibility does not relax theme or RTL requirements.

The initial document must remain usable in:

- light theme;
- dark theme;
- the configured Relay primary accent;
- LTR;
- RTL.

Do not create separate server theme classes with hard-coded colors. Relay semantic roles remain authoritative.

Where the server cannot know a browser-only preference, choose a deterministic safe initial state and transition without duplicating product DOM. Any anti-flash bootstrap in `index.html` must remain tiny, defensive, and free of private data.

Direction changes should be applied through the established i18n/document direction boundary. Feature components continue using logical utilities (`ms`, `me`, `ps`, `pe`, `start`, `end`) regardless of render mode.

## 11. Responsive behavior and zoom

SSR must not infer a mobile, tablet, or desktop layout from browser width on the server.

Use the existing mobile-first CSS/Tailwind responsive system. A single semantic DOM should reflow at 390px, tablet, desktop, 200 percent zoom, and 400 percent zoom.

Do not branch server markup using guessed user-agent viewport widths.

Specialized server request hints may only be introduced through a separately documented architecture decision with cache and privacy implications reviewed.

## 12. Accessibility

Server-rendered markup must already be semantically valid before hydration.

Required:

- visible labels and accessible names are present in server HTML;
- landmark and heading structure is valid;
- IDs and IDREF relationships are stable across hydration;
- disabled/busy/loading states are truthful;
- no duplicate hidden desktop/mobile controls remain focusable;
- links use real destinations when navigation is available;
- button semantics do not depend on a client-only click handler to become meaningful;
- loading and unavailable states do not disappear from the accessibility tree because JavaScript has not run yet.

Hydration may add interactivity. It must not repair fundamentally invalid semantics that the server emitted.

## 13. Spartan overlays and focus

Dialogs, menus, comboboxes, radio groups, and other Spartan-owned interactions should render stable trigger/content semantics while leaving browser-only focus movement and event handling to the primitive after hydration.

Feature code must not:

- call `.focus()` during server render;
- inspect `document.activeElement` without a browser boundary;
- create duplicate server-only overlay markup;
- replace Spartan focus trapping with feature-owned browser detection.

If an overlay is opened from persisted browser-only state, initialize it closed on the server unless the open state is authoritative and deterministic in the server request.

## 14. Media, canvas, calls, and device APIs

These capabilities require explicit browser boundaries.

### 14.1 Canvas and image tools

The surrounding page and controls should remain server-renderable. Canvas context initialization and DOM measurement happen after browser render.

### 14.2 Audio/video playback

Do not instantiate `Audio`, `MediaRecorder`, `RTCPeerConnection`, or request media devices during server render. Render the controls/status shell and activate playback/recording only in the browser.

### 14.3 Calls and live rooms

Routes whose primary function is a live device session may remain client-rendered as already documented by `app.routes.server.ts`.

### 14.4 Notifications and service workers

Registration and permission prompts are browser-only. The application must still server-render without `navigator.serviceWorker` or Notification APIs.

## 15. Error handling

SSR errors are production errors, not signals to return fictional content.

A server-compatible feature should distinguish:

- capability unavailable on the server;
- provider/network unavailable;
- unauthorized/private content;
- not found;
- successful empty state.

Do not swallow arbitrary server exceptions and return a mock user, mock message, fake count, fake translation, or synthetic media URL.

Logs must not include access tokens, full private message content, private media URLs, or raw provider secrets.

## 16. Performance and caching

SSR should improve initial usefulness without creating unbounded server work.

Rules:

- keep render-time data queries bounded;
- avoid N+1 requests from templates/components;
- do not start background browser services on the server;
- avoid serializing large private application stores into HTML;
- treat authenticated HTML as private unless an explicit cache policy says otherwise;
- do not cache user-specific accent, language, profile, or message markup under a shared public key;
- lazy-loaded feature boundaries remain lazy in the browser even when the server can render the route.

## 17. Migration examples

### Example A: direct local storage

Before:

```ts
readonly theme = signal(localStorage.getItem('theme') ?? 'system');
```

After:

```ts
private readonly platformId = inject(PLATFORM_ID);
readonly theme = signal('system');

loadBrowserTheme(): void {
  if (!isPlatformBrowser(this.platformId)) return;

  try {
    this.theme.set(localStorage.getItem('theme') ?? 'system');
  } catch {
    this.theme.set('system');
  }
}
```

A shared storage adapter is preferable when multiple features need the same behavior.

### Example B: DOM measurement

Before:

```ts
constructor() {
  this.width = document.querySelector('.panel')!.clientWidth;
}
```

After:

```ts
constructor() {
  afterNextRender(() => {
    this.width = this.panel().nativeElement.clientWidth;
  });
}
```

### Example C: one browser-only enhancement

Before: mark the entire profile route `RenderMode.Client` because one action copies a URL.

After: keep the profile route server-rendered and perform clipboard access only when the user activates the Copy action in a browser.

### Example D: device-first route

A live video-call route whose useful state depends on WebRTC and media permissions may remain `RenderMode.Client`. The decision belongs in `app.routes.server.ts`, not in scattered component checks.

### Example E: hydration-safe responsive layout

Before:

```ts
if (window.innerWidth < 768) {
  this.mobile = true;
}
```

with separate mobile and desktop templates.

After: one semantic template using normal mobile-first Tailwind breakpoints. CSS adapts after hydration without changing the accessibility tree.

## 18. Prohibited patterns

The following are prohibited in new or migrated code unless a reviewed exception documents why the normal boundary is insufficient:

- browser globals at module scope;
- direct `window`, `document`, `navigator`, storage, media, canvas, or observer use during server execution;
- fake browser globals/polyfills added to the Node SSR runtime to hide incompatible feature code;
- `RenderMode.Client` used as a blanket workaround for a small browser-only child capability;
- server-only and browser-only copies of the same product component tree;
- viewport/user-agent guessing to choose normal responsive layouts;
- `Math.random()`, unstable timestamps, or non-deterministic IDs in hydration-sensitive initial markup;
- reading private browser storage into server HTML;
- exposing tokens or credentials through transfer state or rendered markup;
- hard-coded server theme colours instead of Relay tokens;
- physical-direction styling added only to the server variant;
- feature-owned focus/dialog/menu mechanics added to work around hydration;
- swallowing SSR failures and returning fictional product data;
- application-level service-worker, notification, media, or device initialization during server render.

## 19. Exception policy

An SSR exception must be narrow and documented.

A valid exception records:

1. the exact browser capability involved;
2. why server rendering cannot provide a useful truthful shell;
3. why a smaller child/service boundary is insufficient;
4. the route/component affected;
5. loading/unavailable behavior;
6. accessibility behavior before/without browser activation;
7. privacy and caching implications;
8. verification and rollback.

Client-only route entries belong in `app.routes.server.ts` so the exception inventory remains reviewable.

## 20. Required verification

Every migration that touches browser-dependent code must run the normal frontend verification gate, including at minimum:

```bash
cd frontend
npm run lint:check
npm test
npm run build
```

The production build is important because this repository builds both browser and server output. A browser-only code path that leaks into server compilation or rendering should not be accepted merely because a jsdom unit test passes.

Focused tests should cover the changed capability boundary. Examples:

- construct/render the service or component with a server `PLATFORM_ID`;
- verify storage is not touched on the server;
- verify browser-only side effects are deferred until browser render;
- verify a client-only route is explicitly declared when necessary;
- verify server and initial browser markup keep stable accessible names/relationships.

### 20.1 Follow-up automated guard

The follow-up migration verification ticket should add the smallest effective guard that detects new SSR regressions without blocking historical debt.

Recommended contract:

- verify Angular SSR configuration remains present (`server`, `outputMode: "server"`, SSR entry, server bootstrap, hydration provider);
- verify the documented client-only route exceptions remain explicit;
- scan changed frontend TypeScript for newly introduced browser globals at module scope or constructor-time unguarded browser access;
- allow reviewed framework adapters and tests through a narrow exception mechanism;
- exercise at least one light and one dark server-render/hydration smoke surface;
- include an RTL route or document-direction assertion;
- fail with the file, rule, and suggested platform/capability boundary.

The guard should be migration-safe: newly introduced violations fail, while pre-existing debt is migrated deliberately instead of requiring an unrelated all-at-once rewrite.

## 21. Design-preview contract

This architecture document changes no visual contract by itself, so no new Claude Design preview is required for #5525.

Future component migrations must still update mapped previews when SSR work changes a visible state, layout, theme, responsive behavior, or interaction contract. A purely internal platform guard does not justify visual-preview churn.

## 22. Rollout and rollback

This standard is documentation-only and has no runtime rollout.

Implementation changes that follow it should be incremental:

1. identify the browser capability;
2. keep the shared server-renderable shell where possible;
3. move capability access behind the smallest platform boundary;
4. add focused server/browser regression coverage;
5. run browser and server production builds;
6. update route render mode only when the whole route genuinely requires it.

Rollback should revert the focused capability change. Do not solve a regression by globally disabling SSR or converting broad route families to `RenderMode.Client` unless an incident-specific rollback explicitly requires that temporary measure.

## 23. Definition of done for migrated surfaces

An SSR-migrated surface is complete when:

- server rendering does not execute unsupported browser APIs;
- the route uses server rendering unless a documented client-only exception is justified;
- server markup is truthful and privacy-safe;
- hydration preserves semantic structure and accessible relationships;
- light/dark, primary accent, responsive behavior, and RTL remain Relay-owned and consistent;
- Spartan retains ownership of generic interaction mechanics;
- browser-only enhancements activate after the appropriate platform/render boundary;
- storage/device/provider failures remain honest and retryable where applicable;
- no private credentials or browser-only user data are serialized into HTML;
- focused SSR/browser tests cover the changed boundary;
- frontend lint, tests, and production server/browser build validation pass;
- any visible contract change has the required Claude Design/design-preview reconciliation.

This is the canonical SSR compatibility contract for the Spartan + Relay migration. Feature-specific audit documents may add stricter requirements, but they must not weaken or contradict this standard.
