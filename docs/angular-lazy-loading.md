# Angular standalone lazy-loaded route integration

Issues #1817 and #5535 define the repository contract for route-level code splitting. #1817 established the executable standalone lazy-loading baseline. #5535 defines how lazy route boundaries integrate with Angular 22, Spartan interaction primitives, Relay presentation, SSR/hydration, accessibility, themes, RTL and repository verification.

This document is authoritative for frontend route-loading architecture. It does not require feature `NgModule` classes. The application is standalone Angular, so lazy route integration is expressed with `loadComponent` and, when a route collection deserves its own chunk boundary, `loadChildren`.

## Goals

Lazy loading in this repository must:

- keep non-critical feature implementation out of the initial browser bundle;
- preserve stable URLs, redirects, route parameters, route titles and authorization behavior;
- preserve server rendering and hydration for routes that support them;
- preserve light and dark theme behavior and the per-user `primary` Relay token;
- preserve RTL, localisation, 390px mobile-first layout and high-zoom reflow;
- keep Spartan Brain/Helm interaction ownership inside the feature or Relay primitive that uses it;
- avoid duplicate route-specific UI implementations for themes, locales, screen sizes or render modes;
- keep failure, loading and unauthorized behavior truthful rather than silently broadening access or rendering synthetic success state;
- remain measurable and enforceable by tests rather than relying on review convention alone.

## Current implementation audit

### Router bootstrap

`frontend/src/app/app.config.ts` owns application-wide router setup:

```ts
provideRouter(routes, withComponentInputBinding())
```

The same application config owns global HTTP, hydration, animations, translation, service-worker and error-handling providers. Lazy features must not duplicate those providers merely because their code is loaded later.

The router is configured without a global `PreloadAllModules` strategy. This is intentional. A lazy route should remain lazy until product evidence justifies preloading it.

### Root route table

`frontend/src/app/app.routes.ts` contains a small root table plus route-definition collections imported from `frontend/src/app/routes/`:

- `auth.routes.ts`
- `media.routes.ts`
- `learning.routes.ts`
- `commerce.routes.ts`
- `social.routes.ts`
- `settings.routes.ts`
- `chat.routes.ts`
- `admin.routes.ts`

The route-definition arrays themselves are currently imported eagerly. Their routed components are not. Representative product surfaces such as Community, Vocabulary, Discovery, Moments, Events, Settings and Chat use dynamic `loadComponent` imports.

That distinction matters: a statically imported `Routes` array is acceptable when it contains only lightweight route metadata and dynamic component loaders. It is not evidence that the feature implementation itself is eagerly bundled.

If a route collection grows expensive providers, guards, resolvers or other implementation code, it may become a candidate for a `loadChildren` boundary. The change must be motivated by bundle/runtime evidence, not by a preference for more files or more chunks.

### Redirect routes

Redirect-only routes use `redirectTo` and `pathMatch` without attaching component loaders. Redirects are routing metadata, not feature views, and must not load feature code only to perform a redirect.

### Existing executable contract

`frontend/src/app/app.routes.lazy-loading.spec.ts` already verifies that:

- routed Angular components are not attached through eager `Route.component` properties;
- representative non-critical product routes retain `loadComponent` or `loadChildren` loaders;
- redirect-only routes remain free of component loaders.

This is the current minimum regression boundary. Follow-up issue #5536 owns the migration-specific verification gate described later in this document.

### Server rendering

`frontend/src/app/app.routes.server.ts` defines server rendering independently from browser chunk boundaries. Most routes use `RenderMode.Server`. Explicit browser-capability surfaces such as active calls, video calls, audio rooms and device transfer use `RenderMode.Client`.

Lazy loading and SSR are separate decisions:

- `loadComponent` or `loadChildren` controls when application code is loaded;
- `RenderMode.Server` or `RenderMode.Client` controls where the route initially renders.

A route may be lazy and server-rendered. A route may also be lazy and client-rendered. Do not convert a route to client rendering merely to avoid fixing an SSR-safe import or hydration defect.

## Ownership model

The dependency direction established by `DESIGN.md` and the Spartan migration remains unchanged at lazy boundaries:

```text
router metadata
  -> feature screen
    -> Relay presentation wrapper, when one exists
      -> primitive-specific Spartan Helm
        -> primitive-specific Spartan Brain
```

### Router owns

The router owns:

- URL matching;
- redirects;
- route parameters and component input binding;
- route-level guards and resolvers;
- route-local provider lifetime where explicitly required;
- route title metadata;
- the dynamic import boundary.

The router does not own component styling, focus rings, button semantics, dialogs, combobox behavior or product data rendering.

### Feature screen owns

A lazy feature screen owns:

- product-specific data loading and mutation orchestration;
- feature loading, empty, unavailable and unauthorized presentation;
- route-specific composition;
- feature-specific analytics and observability hooks;
- navigation triggered by product actions.

It must not recreate behavior already owned by an approved Relay or Spartan primitive.

### Relay owns

Relay owns semantic visual presentation:

- `surface-*` roles;
- `text-*` roles;
- `primary`, `secondary`, `danger`, `success`, `warning`, `vip` and `on-fill` roles;
- semantic radius and elevation roles;
- mobile-first layout composition where implemented by a shared Relay wrapper.

Lazy loading must never create a second light-only, dark-only, locale-specific or accent-specific component branch.

### Spartan owns

Spartan Brain/Helm owns interaction behavior where a primitive exists, including keyboard, focus, disabled state and overlay mechanics. A lazy feature imports only the primitive-specific pieces it needs. Do not import a broad Spartan barrel or eagerly aggregate unrelated primitive sets in a shared route file.

This keeps both ownership and tree-shaking boundaries clear.

## Canonical route APIs

### One routed standalone component

Use `loadComponent` for a route whose boundary is one standalone screen:

```ts
{
  path: 'example',
  loadComponent: () =>
    import('../components/example/example.component').then(
      (m) => m.ExampleComponent,
    ),
}
```

Requirements:

- the imported component must be standalone;
- the import must point directly at the feature boundary rather than an eager root barrel;
- the module must be safe to import in every render mode assigned to that route;
- product data must not be fetched at module top level;
- browser globals must not be accessed at module top level.

### Lazy route collection

Use `loadChildren` when the child route table itself deserves a chunk boundary:

```ts
{
  path: 'example',
  loadChildren: () =>
    import('./routes/example.routes').then((m) => m.exampleRoutes),
}
```

A `loadChildren` boundary is appropriate when one or more of these are true:

- a large feature contains several related screens that should load together;
- route-local providers are meaningful for the whole feature subtree;
- the route-definition module has become non-trivial enough that keeping it out of bootstrap is measurable;
- a feature team needs a clear subtree authorization or lifecycle boundary.

Do not introduce `loadChildren` solely to copy a module-era Angular pattern.

### Redirects

Use metadata-only redirects:

```ts
{
  path: 'old-path',
  redirectTo: 'new-path',
  pathMatch: 'full',
}
```

Do not attach `loadComponent`, `loadChildren` or a placeholder component to a pure redirect.

### Route-local providers

Route-local `providers` are allowed only when the provider lifetime truly belongs to that route or subtree. Shared authentication, theme, translation, configuration, HTTP and realtime infrastructure remains application-owned.

A route provider must not create a second instance of a service whose state is intentionally shared across navigation. Examples include theme state, authentication state, unread counters and shared realtime connection state.

## Authorization and privacy

Lazy loading is a performance boundary, not a security boundary.

Client route guards improve UX but never replace backend authorization. Sensitive API responses must remain protected server-side even if a route is not loaded for an unauthorized user.

Rules:

- never embed privileged data in route metadata;
- never encode credentials, tokens or private profile data in dynamic import paths;
- prefer route matching/guard decisions before expensive feature initialization where practical;
- unauthorized routes must show or navigate to the established unauthorized/sign-in experience without briefly rendering privileged content;
- do not log full route state when it contains user-generated identifiers or sensitive query parameters;
- route-level error diagnostics must be sanitized.

## Data loading and navigation states

A dynamic import is not the same as product data loading. The screen must still model its own authoritative data state.

### Loading

If feature data is pending after the component loads, expose the product loading state through the established component/Relay pattern. Do not leave an unexplained blank region because the route arrived before data.

### Empty

A successful empty API result is an empty product state, not an error. It must remain distinguishable from loader failure.

### Unavailable

An API, dynamic-import or provider failure must not be converted into fabricated product data. A retryable route should expose an accessible retry path where the existing product contract supports retry.

### Unauthorized

Unauthorized is not empty. Preserve the authentication/authorization boundary and do not substitute an empty list or default profile.

### Redirecting

Redirect routes should avoid loading UI that will never be displayed. Keep them metadata-only unless the product flow genuinely needs an intermediate view.

## SSR and hydration contract

Lazy route files participate in the same SSR and hydration standards as eagerly loaded code.

### Import safety

For server-rendered routes, dynamic imports must be safe when evaluated on the server. Prohibited at module top level:

- direct `window` access;
- direct `document` access outside Angular injection/platform guards;
- direct `navigator`, `localStorage`, `sessionStorage`, `matchMedia`, media-device or canvas access;
- DOM measurement or mutation;
- timers whose creation is a side effect of importing the module.

Browser-only capability work belongs after platform checks and inside the component/service lifecycle that owns it.

### Hydration stability

The initial client render must agree with the server-rendered structure. Lazy route integration must not:

- choose a different component solely from browser viewport width before hydration;
- branch the first template on `localStorage` without a stable hydration strategy;
- create random IDs or unstable ordering during first render;
- mutate server-rendered DOM before Angular hydrates it.

Theme, language and direction must use the repository-wide services/contracts rather than route-specific bootstrapping.

### Client-render exceptions

Use `RenderMode.Client` only for routes whose browser capability requirements genuinely prevent useful server rendering. The current call/device routes are examples. A lazy route is not automatically a client-render route.

## Spartan and Relay integration across chunks

A lazy chunk must behave exactly like an eagerly available screen once loaded.

### Theme parity

- use Relay semantic tokens;
- do not hardcode product colors inside lazy feature templates;
- do not create separate dark-theme route components;
- preserve the user's dynamic primary accent by consuming the `primary` token;
- ensure loading and error states also use semantic tokens.

### RTL parity

- route loading must not reset document direction;
- feature layout uses logical utilities such as `ps`, `pe`, `ms`, `me`, `border-s` and `border-e`;
- do not create separate LTR and RTL route definitions;
- directional icons must follow their primitive/product semantics, not the lazy-loading mechanism.

### Responsive parity

The route must support the same component tree from the 390px mobile baseline through tablet and desktop composition. Do not select different route components from viewport sniffing.

Responsive layout belongs in component composition and Tailwind/Relay rules. Lazy boundaries may follow product feature boundaries, not device classes.

### Zoom and reflow

A lazy screen must remain operable at 200% and 400% zoom under the repository zoom contracts. Dynamic loading must not hide essential actions behind a fixed-size loading shell or route-specific viewport lock.

## Accessibility contract

Lazy loading must be transparent to keyboard and assistive-technology users.

### Semantics

The final feature uses the same native/Spartan semantic controls it would use if eagerly loaded. Do not add synthetic buttons, positive `tabindex` values or custom key emulation as a workaround for route loading.

### Focus

Navigation must not create a second focus order while a chunk loads. When product UX requires explicit post-navigation focus, it must target a stable semantic landmark or heading after the routed view is ready, not an arbitrary wrapper.

Dialogs/popovers opened inside a lazy route remain owned by their Spartan primitive, including focus trapping and restoration.

### Announcements

A product loading or failure announcement may be appropriate when navigation leaves the user waiting. Use the existing loading/error state contract. Do not announce low-level chunk names or internal file paths.

### Route titles

Route title metadata should remain meaningful and localisable under the repository's route-title conventions. Code splitting must not remove page identity for screen-reader or browser-history users.

## Performance and bundle policy

Lazy loading exists to reduce work, not to maximize chunk count.

### Initial bundle

Non-critical feature implementation should stay out of the initial application bundle. `loadComponent` is the normal boundary for standalone screens.

### Chunk granularity

Avoid both extremes:

- one giant lazy chunk containing unrelated product areas;
- dozens of tiny route-only chunks whose overhead exceeds their benefit.

Prefer coherent product boundaries and use production bundle evidence when changing chunk granularity.

### Shared dependencies

Do not duplicate a dependency merely to make a feature lazy. Angular's builder may extract shared code. Keep imports direct and tree-shakeable, especially for Spartan primitives and optional SDKs.

### Preloading

The current router does not globally preload all lazy routes. Do not add `PreloadAllModules` as a blanket optimization.

A future preloading policy must:

1. be based on measured navigation latency and bundle/network cost;
2. avoid loading authenticated/private features before authorization is known where that would create unnecessary work;
3. respect reduced-data/network constraints where available;
4. remain deterministic under SSR/hydration;
5. include a rollback path and bundle regression coverage.

## Route guards, resolvers and providers

### Guards

Keep guards lightweight. A route guard should not import the feature component or its visual dependencies. Route matching should be able to reject access without defeating the code-splitting boundary.

### Resolvers

Resolvers are appropriate only when navigation truly requires data before activation. Do not move every feature API call into a resolver to make the screen appear fully populated. That can turn parallel UI loading into blocking navigation and can obscure partial-failure states.

### Providers

Use route providers to scope state only when that lifecycle is deliberate. Shared core state remains in application providers. A lazy route must not silently create duplicate instances of global services.

## Localisation and complex scripts

Lazy routes must use the same translation and script-rendering contracts as the rest of the application:

- no product copy in dynamic import errors shown directly to users;
- no locale-specific component imports as a substitute for translation;
- no route-specific font stack for CJK, Arabic, Devanagari or other complex scripts;
- user-generated/translated content stays on the system `font-sans` stack;
- language and direction state must already be established when the lazy component renders.

Long translations must reflow without changing the route boundary.

## Error handling and observability

Dynamic import failures can occur because of network interruptions, stale browser assets after deployment, or a genuine build defect.

Rules:

- use the repository's central error handling rather than logging raw errors from every route;
- do not expose chunk filenames, stack traces or signed asset URLs in user-facing messages;
- do not log authentication tokens or sensitive route query values;
- preserve enough sanitized context to distinguish navigation failure from feature API failure;
- a retry path must retry navigation/import safely rather than fabricate a successful screen;
- service worker/version rollout policy should handle stale-client asset mismatches at the application boundary, not through per-feature hacks.

## Migration patterns

### Eager routed component to standalone lazy component

Before:

```ts
import { ExampleComponent } from './example.component';

{
  path: 'example',
  component: ExampleComponent,
}
```

After:

```ts
{
  path: 'example',
  loadComponent: () =>
    import('./example.component').then((m) => m.ExampleComponent),
}
```

Keep route path, guards, data, title and parameter semantics unchanged unless the product change explicitly requires otherwise.

### Large route collection to lazy child routes

Before:

```ts
import { exampleRoutes } from './routes/example.routes';

export const routes: Routes = [
  ...exampleRoutes,
];
```

After, only when the extra boundary is justified:

```ts
export const routes: Routes = [
  {
    path: 'example',
    loadChildren: () =>
      import('./routes/example.routes').then((m) => m.exampleRoutes),
  },
];
```

Do not perform this mechanically if it would change existing URLs by introducing an extra path segment. A child route table may need path adjustments to preserve the public URL contract.

### Theme-specific component split

Prohibited:

```ts
loadComponent: () =>
  theme.isDark()
    ? import('./example-dark.component').then((m) => m.ExampleDarkComponent)
    : import('./example-light.component').then((m) => m.ExampleLightComponent)
```

Required:

```ts
loadComponent: () =>
  import('./example.component').then((m) => m.ExampleComponent)
```

The component consumes Relay semantic tokens so both themes share one semantic tree.

### Device-specific component split

Prohibited:

```ts
loadComponent: () =>
  window.innerWidth < 768
    ? import('./example-mobile.component').then((m) => m.ExampleMobileComponent)
    : import('./example-desktop.component').then((m) => m.ExampleDesktopComponent)
```

Required: one routed feature component with responsive composition. This preserves SSR/hydration, focus, state and URL behavior.

### Broad primitive barrel

Avoid a lazy route/component importing a broad UI barrel that re-exports unrelated Spartan primitives. Import the approved Relay wrapper or primitive-specific Helm pieces required by the feature. This supports the tree-shaking policy and keeps ownership visible in review.

## Prohibited patterns

Do not introduce:

- eager `Route.component` for non-critical product screens;
- feature `NgModule` classes solely to obtain lazy loading;
- placeholder components for pure redirects;
- dynamic import paths built from user input;
- theme-specific, locale-specific, RTL-specific or viewport-specific route components;
- direct browser-global access at module top level on server-rendered routes;
- module-import side effects that fetch product data or start subscriptions;
- route guards that eagerly import the feature they protect;
- duplicated application-wide providers inside lazy routes;
- blanket `PreloadAllModules` without measured justification;
- feature-specific copies of shared Spartan/Relay behavior;
- raw route-load errors rendered to users;
- `ngSkipHydration` or `RenderMode.Client` as a general escape hatch for lazy-route defects;
- artificial child-route boundaries that change public URLs without an explicit migration plan.

## Review checklist

For any PR adding or changing a routed feature, verify:

- [ ] the screen remains standalone;
- [ ] non-critical component code is loaded through `loadComponent` or justified `loadChildren`;
- [ ] redirects remain metadata-only;
- [ ] URL, parameter, title and guard contracts are preserved;
- [ ] route providers do not duplicate global state;
- [ ] server-rendered modules are safe to import on the server;
- [ ] hydration does not depend on browser-only first-render branching;
- [ ] Relay tokens preserve light/dark and user accent behavior;
- [ ] logical layout preserves RTL;
- [ ] the same component supports 390px, tablet, desktop, 200% and 400% reflow;
- [ ] keyboard/focus/screen-reader semantics are unchanged or improved;
- [ ] feature loading, empty, unavailable and unauthorized states remain distinct;
- [ ] no sensitive values are introduced into route metadata or diagnostics;
- [ ] bundle/chunk behavior is appropriate for the product boundary;
- [ ] route regression tests are updated when the route contract changes.

## Verification contract

### Existing minimum test

`frontend/src/app/app.routes.lazy-loading.spec.ts` is the current executable minimum. It protects the most important structural rule: routed product components must not drift back to eager `Route.component` ownership.

Run it through the normal frontend unit suite:

```bash
cd frontend
npm run test -- --watch=false
```

Also run the normal static and production checks:

```bash
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run build
```

Repository CI remains authoritative for clean dependency installation, SSR compilation and the wider frontend contract.

### Follow-up migration gate: #5536

Issue #5536 should add the smallest migration-safe automated gate that can run cheaply on pull requests. It should at minimum detect newly introduced:

1. eager routed `component` properties for feature screens;
2. redirects that acquire component loaders;
3. lazy-route imports that point through known eager feature barrels;
4. route-level duplicate providers for application-owned theme/auth/i18n/realtime state where statically detectable;
5. route configuration that introduces obvious theme, RTL or viewport-specific component selection;
6. regressions in representative lazy route registrations.

The gate should prefer changed-file or baseline-aware enforcement so historical route debt can be migrated deliberately without making unrelated PRs impossible to land.

A rendered Claude Design preview is not required for #5535 because this issue defines architecture and changes no visual contract. A future route migration that changes a visible screen still follows the normal design-sync rules.

## Expected failure modes

A lazy-route verification failure should identify the route or source file and the violated ownership rule. Useful examples:

```text
Route "events" uses eager Route.component; use loadComponent or justify a bootstrap-critical exception.
Redirect "message-filters" must not attach a component loader.
Lazy route "example" selects a component from window.innerWidth; keep device composition inside the feature.
```

Do not emit user data, route query contents, tokens or full production URLs in CI diagnostics.

## Rollout and rollback

This architecture update changes documentation only. It does not modify routes, chunks, APIs, schema, persisted state, analytics or visual output.

Future route migrations should land as focused changes with:

1. route-contract tests;
2. frontend unit/static/build verification;
3. SSR/hydration verification when the render mode is affected;
4. design-sync updates only when the visible contract changes;
5. a rollback that restores the previous route loader without changing user data.

If a new lazy boundary causes production navigation or chunk-loading problems, roll back the route boundary first. Do not disable authentication, SSR, hydration, accessibility checks or design-system ownership to keep the new chunk split.

## Decision summary

The canonical elgl frontend route-loading architecture is:

```text
standalone Angular route metadata
  -> loadComponent for normal feature screens
  -> loadChildren only for justified route-subtree boundaries
  -> one semantic component tree across themes, locales, RTL and viewport sizes
  -> Relay presentation
  -> primitive-specific Spartan interaction ownership
  -> server/client render mode chosen independently from chunk loading
```

This preserves Angular 22 standalone conventions while making performance boundaries compatible with the rest of the repository's accessibility, design, SSR, hydration, privacy and verification contracts.
