# Mobile social application audit

## Scope and evidence

This is a static code audit of the Angular application as a mobile web app and installed PWA. It does not claim native-device behaviour that is not covered by source or tests. Dimensions on decorative SVGs and status indicators are not treated as touch-target dimensions; the enclosing interactive element is the target.

Priority meanings:

- **P0**: accessibility or data-integrity risk that should block release.
- **P1**: high-impact mobile interaction defect.
- **P2**: resilience or consistency work that should be scheduled.
- **Verify**: plausible risk requiring a rendered or device test before calling it a defect.

## Findings

### P0: restore browser zoom

`frontend/src/index.html` includes `viewport-fit=cover` and `interactive-widget=resizes-content`, which are useful mobile settings, but it also sets `maximum-scale=1` and `user-scalable=no`. Those restrictions prevent pinch zoom in browsers that honour them and conflict with the repository's high-zoom accessibility contract.

**Required change**

- Keep `width=device-width`, `initial-scale=1`, `viewport-fit=cover` and `interactive-widget=resizes-content`.
- Remove `maximum-scale=1` and `user-scalable=no`.
- Add a mobile browser test confirming that the page remains zoomable and usable at 200% and 400%.

### P1: make safe-area ownership singular and verifiable

`frontend/src/styles.scss` applies top and inline safe-area padding to both `html` and `body`. Because the body is inside the padded root element, this can double the inset. The mobile bottom navigation uses `pb-safe`, but no repository CSS or Tailwind configuration defines that utility, and the current production CSS build does not emit a `.pb-safe` selector. Bottom content can therefore sit against the home indicator while top and side content are over-inset.

**Required change**

- Apply viewport safe-area padding at one application-shell boundary, not independently to both `html` and `body`.
- Define a real bottom-safe-area utility or use `padding-bottom: env(safe-area-inset-bottom)` at the navigation boundary.
- Preserve physical left/right inset mapping when the document direction changes.
- Add portrait, landscape and RTL tests that inspect computed padding rather than class names.

### P1: measure actual interactive targets

The shared Spartan button variants provide explicit 44px mobile sizes through `touch` and `icon-touch`. Several examples in the original audit were decorative icons or delivery-status glyphs inside larger controls and were not evidence of small targets.

Confirmed exceptions still exist:

- The filter button in `frontend/src/app/components/chat-list/chat-list.component.html` explicitly overrides its target to `w-7 h-7`, which is 28px by 28px.
- The video-stream checkbox in `frontend/src/app/components/voiceroom-create-modal/voiceroom-create-modal.component.ts` is 16px by 16px and its label has no minimum block size. The label increases the clickable width, but does not guarantee a 44px-high target.

**Required change**

- Use `icon-touch`, `min-h-11` and `min-w-11`, or an equivalent labelled hit area for confirmed compact controls.
- Add a rendered 390px audit that checks computed bounding boxes for interactive elements. Do not flag non-interactive icons or status badges.

### P1: cancel chat long press when the user scrolls

`frontend/src/app/directives/flashcard-context-menu.directive.ts` implements a real 650ms touch timer, cancels after movement beyond 12px, and retains the desktop context-menu path. That is a sound cross-input pattern.

`frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.ts` also uses a timer, but it has no `touchmove` or pointer-movement cancellation. A user who holds a message while beginning to scroll can therefore open the action dialog unintentionally.

**Required change**

- Add a movement threshold and cancel the timer on movement, multi-touch, cancellation and component destruction.
- Preserve the existing keyboard-only action trigger and accessible Spartan dialog.
- Test deliberate long press, normal scroll, multi-touch, cancellation and teardown.

### P1: do not report failed voice-note uploads as success

`frontend/src/app/components/voice-recorder/voice-recorder.component.ts` catches an upload failure and emits either a local object URL or `http://mock-voice-url/ogg` through the success output. A failed mobile upload can therefore appear sent even though the recipient cannot retrieve it. The same component logs raw errors and shows a hard-coded English permission message.

**Required change**

- Keep the local recording available for retry and expose a translated error state.
- Emit `audioUploaded` only after a confirmed durable upload.
- Remove the mock URL from production behaviour and avoid logging raw provider or device errors.
- Add denied-permission, offline-upload, retry, cancellation and stream-cleanup tests.

### P2: standardise media permission and failure states

Media capture is not uniformly incomplete. `audio-intro-recorder.component.ts` checks API availability, preserves a previous take when re-record permission fails, stops tracks, bounds duration, validates upload URLs and retains failed uploads for retry. Other recorders still expose raw exception text or hard-coded English strings, and `PermissionService` reduces every failure to a boolean.

**Recommended change**

- Reuse a typed permission result such as unavailable, denied, dismissed and device-busy.
- Keep user-facing copy behind the translation service.
- Stop all tracks on success, failure, cancel, navigation and component destruction.
- Preserve recordings across transient upload failures and never convert failure into success.

### P2: define one overlay stack across rendering systems

Spartan `HlmDialog` supplies the dialog state, focus, Escape and backdrop contract for converted overlays. The application shell also renders fixed overlays with independent z-index tiers, including incoming calls, gifts, connectivity and forced-update UI. Z-index values alone do not constitute modal-stack logic, especially when CDK portal overlays and shell-owned fixed overlays can coexist.

**Recommended change**

- Document a single overlay priority table covering CDK/Spartan portals and shell-owned fixed layers.
- Ensure only the top modal is interactive and exposed as modal to assistive technology.
- Test focus restoration, Escape ownership, scroll locking and concurrent states such as a permission prompt, incoming call and forced update.

### P2: integrate open overlays with browser and hardware back

Route-level screens correctly use Angular `Location.back()` where a visible back action exists. `DeepLinkService` handles launch and runtime deep links, but there is no central `popstate` or Capacitor hardware-back integration that closes the top application overlay before navigating the underlying route. Spartan dialogs handle Escape and backdrop dismissal, which does not establish Android hardware-back behaviour.

**Recommended change**

- Route dismissible application overlays through a central coordinator.
- On browser or hardware back, close the top dismissible overlay first; never dismiss forced-update or other non-dismissible safety UI.
- Add history, deep-link, nested-overlay and Android back-button regression tests.

### Verify: virtual keyboard and viewport resizing

The viewport opts into `interactive-widget=resizes-content`, global layout uses `100dvh`, and chat surfaces use bounded flex layouts with internal scrolling. These are positive foundations. There is no focused device test proving that the chat composer, active field, validation message and bottom navigation remain visible when the iOS or Android keyboard opens. The chat room also uses a fixed `h-[78vh]` surface, which should be verified with the resized visual viewport.

**Verification required**

- Test iOS Safari and Android Chrome with the keyboard open in chat, search, create and modal forms.
- Confirm focused controls scroll into view, the composer remains reachable, and the fixed bottom navigation does not consume keyboard-reduced space.
- Test rotation and keyboard dismissal without stale height or scroll offsets.

### Verified strengths

- Global vertical overscroll is disabled and nested overlay/list surfaces use local `overscroll-contain` or `overscroll-none` where appropriate.
- Native text selection remains enabled for inputs, textareas and editable content while application chrome suppresses accidental selection and tap highlights.
- The shared View Transition service falls back safely on unsupported browsers and skips visual transitions for reduced-motion users.
- The mobile bottom navigation is placed in the thumb-reachable bottom region and each route link has a broad 64px column within a 60px bar. Its safe-area padding still needs the P1 fix above.
- Converted dialogs provide semantic modal behaviour through Spartan rather than relying only on visual z-index.

## Device acceptance matrix

Before treating the mobile audit as complete, run the following on iOS Safari, Android Chrome and installed PWA mode:

1. Portrait and landscape safe areas, including RTL.
2. Pinch zoom plus 200% and 400% reflow.
3. Keyboard-open chat, search and modal forms.
4. 44px computed hit boxes for interactive controls at the 390px baseline.
5. Long press while stationary, scrolling and cancelling.
6. Microphone and camera allowed, denied, dismissed, unavailable and busy.
7. Upload interruption, retry and navigation cleanup.
8. Browser and hardware back with one and multiple overlays open.
9. Reduced motion, screen-reader focus order and modal focus restoration.

The P0 and P1 findings are source-confirmed. Items marked Verify must remain verification tasks until device evidence exists.
