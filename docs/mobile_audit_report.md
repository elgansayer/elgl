# Mobile application audit report

Status: point-in-time source audit reviewed on 7 September 2026.

This report assesses thumb reach, virtual-keyboard behaviour, scrolling, overlays, safe areas,
back navigation, touch targets, media capture, long presses, voice recording and transitions. It
consolidates the former `mobile_audit.md` and `mobile_ux_audit.md` reports, whose implementation
claims had become stale.

The findings below distinguish source-verified behaviour from browser behaviour that still needs
rendered or device coverage. The normative mobile requirements remain in
`docs/390px-mobile-baseline.md`, `docs/touch-target-sizing.md` and
`docs/keyboard-interaction-standards.md`.

## Verified implementation

### Viewport and document shell

- `frontend/src/index.html` includes `viewport-fit=cover` and
  `interactive-widget=resizes-content` in the viewport declaration.
- `frontend/src/styles.scss` gives `html, body` a `100dvh` height, disables vertical overscroll,
  removes the tap highlight and disables the default WebKit touch callout.
- Text selection is disabled on the document shell and restored for `input`, `textarea` and
  `[contenteditable="true"]` elements.
- The document shell applies the top, physical-left and physical-right safe-area insets. Its RTL
  override maps the physical left and right insets to the correct logical sides.

These declarations are useful platform inputs, but `interactive-widget=resizes-content` alone is
not proof that every focused field remains visible above every virtual keyboard. That outcome
depends on each scroll container and overlay and requires rendered browser coverage.

### Navigation and touch sizing

- `frontend/src/app/app.component.html` places the five primary mobile destinations in a fixed
  bottom navigation bar with a 60 CSS-pixel visual row.
- The owned primary and secondary button components map their default `md` size to the Spartan
  `touch` size. `frontend/src/app/components/ui/button/src/lib/hlm-button.ts` defines that size
  with `min-h-11`, which is the repository's 44 CSS-pixel minimum height.
- Several feature controls and labelled rows explicitly use `min-h-11` and, for icon-only
  controls, `min-w-11` or `size="icon-touch"`.

Padding or a 60-pixel parent row does not prove the size of every interactive descendant. The
bottom-navigation links have a fixed width but no explicit minimum height, and the `sm` button
variant is intentionally denser. Representative controls therefore still need rendered geometry
checks before the repository can claim complete compliance with the 44 by 44 CSS-pixel baseline.

### Scrolling and overlays

- The document shell uses `overscroll-behavior-y: none`.
- The correction and report-user modal scroll regions use `overscroll-contain`, as do the owned
  combobox and autocomplete lists. This prevents scroll chaining for those specific regions.
- The lightbox is an owned Helm dialog using a portal. Its content fills the dynamic viewport with
  `fixed inset-0`, `h-dvh` and `w-screen`, and it sits at `z-[100]` with controls at `z-[110]`.
- The lightbox content uses `overscroll-none`. That utility controls overscroll behaviour on the
  lightbox; it is not itself a body-scroll lock. No lightbox-specific test currently proves that
  the page behind it cannot scroll on touch browsers.

The z-index examples show the intended ordering for the lightbox, but a list of z-index values is
not proof that every combination of nested dialogs and overlays stacks correctly. Focus trapping,
background inertness, nested stacking and scroll locking require component or rendered tests.

### Long press and context menus

- `FlashcardContextMenuDirective` starts its 650 ms timer on a single `touchstart`. It cancels on
  movement beyond 12 CSS pixels, touch end, touch cancellation and destruction. A `contextmenu`
  event is handled directly and does not start the timer.
- `LongPressContextMenuComponent` starts its 600 ms timer on a single touch or primary mouse down.
  It cancels on touch end/cancellation, mouse up/leave and destruction. A `contextmenu` event opens
  the menu directly.
- Both interactions expose non-timed alternatives: the browser context-menu path and an accessible
  focusable action trigger respectively.

`LongPressContextMenuComponent` does not currently cancel its timer on touch movement. A slow
scroll can therefore satisfy the timer unless the browser emits `touchcancel`; this needs a
movement threshold and regression coverage matching the flashcard directive.

### Audio capture

- `AudioIntroRecorderComponent` checks for `getUserMedia` and `MediaRecorder`, reports a translated
  error state, stops media tracks, caps recording at 30 seconds and revokes local object URLs.
- It retains a previous unsaved take until microphone access and a replacement recorder have both
  started. Permission denial or an unavailable recorder therefore does not destroy that take.
- Upload errors retain the local take for retry. Persisted and upload URLs are restricted to HTTP
  or HTTPS before use.
- `VoiceRecorderComponent` also captures audio with `getUserMedia`, stops its tracks on completion
  or destruction and revokes its current preview URL on cancellation or destruction.

The two recorders do not yet have the same failure contract. `VoiceRecorderComponent` has no
explicit API-availability check or maximum duration, shows a hard-coded English toast, and emits a
local blob URL or mock URL as a successful result after an upload failure. Starting a new take can
also replace its previous preview URL without first revoking it. These are implementation gaps,
not graceful-failure behaviour.

### Motion

- `frontend/src/styles.scss` defines `animate-fadeIn` and `content-state-enter`, and components use
  Tailwind transition utilities for immediate interaction feedback.
- Some feature components and the view-transition service honour `prefers-reduced-motion`.

The global `animate-fadeIn` and `content-state-enter` rules do not currently include a reduced-
motion override. Their existence demonstrates motion, not that every transition is interruptible
or accessible.

## Gaps requiring follow-up

1. **Safe-area completion:** `app.component.html` uses `pb-safe`, but no matching utility or safe-
   area plugin is defined in the checked-in Tailwind or stylesheet configuration. The document
   shell also applies no bottom inset. Define one owned safe-area contract, cover the mobile nav
   and bottom-aligned overlays, and test both LTR and RTL.
2. **Rendered touch-target evidence:** measure the mobile navigation, representative icon actions,
   dense `sm` buttons, inputs and text areas at 390 CSS pixels. Do not infer compliance from
   padding alone.
3. **Virtual-keyboard coverage:** add a rendered mobile test proving focused fields in a page,
   dialog and bottom-aligned composer remain visible and scrollable when the visual viewport
   shrinks.
4. **Back-navigation contract:** repository search finds no global `popstate` or equivalent overlay
   history integration. Verify Android/browser back and edge-swipe behaviour, then define whether
   the topmost dialog closes or navigation proceeds.
5. **Lightbox isolation:** prove body-scroll locking, focus containment, Escape/backdrop closure and
   restoration after close. Keep the responsibility in the owned Spartan dialog layer where
   possible.
6. **Long-press movement:** add movement cancellation and tests to
   `LongPressContextMenuComponent` so a scrolling gesture cannot open message actions.
7. **Voice-recorder parity:** replace the upload-failure success fallback, translate failure copy,
   bound duration, preflight browser APIs and revoke superseded object URLs.
8. **Reduced motion:** add a shared reduced-motion treatment for the two global entrance
   animations and verify state changes remain understandable without motion.
9. **Mobile keyboard hints:** no `inputmode` or `enterkeyhint` use was found in the Angular feature
   tree. Add them to fields where the semantic input type does not already provide the right mobile
   keyboard and action key.

## Validation boundary

This is a static source audit. It does not claim that browser-specific keyboard resizing, safe-area
rendering, gesture cancellation, overlay stacking or touch-target geometry has passed on physical
devices. The existing 390px visual-contract gate covers viewport, theme, RTL, text scaling and
document overflow for representative previews; the follow-ups above need focused interaction and
geometry tests before their runtime behaviour can be marked complete.
