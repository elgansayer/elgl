# Document viewer interaction ownership

Issue: #6149  
Target: `frontend/src/app/components/document-viewer`

## Outcome

The document viewer does not need a Spartan Brain or Helm interaction primitive. The current surface is deliberately presentation-only: it renders a Relay-owned card/shell and projects caller-owned document content without introducing its own buttons, form controls, dialogs, menus, tabs, imperative fragment navigation, focus state machine, disabled state, loading state, or error action.

This is the intended result of the interaction-conversion stage, not a missing conversion. Native HTML must remain authoritative for any links or controls supplied by the embedding legal/document page. Wrapping projected links in button behaviour or intercepting their activation would weaken browser semantics and couple this reusable presentation component to caller behaviour.

## Implementation

- `DocumentViewerComponent` imports only the shared Relay `AppCardComponent`; the unused `CommonModule` dependency has been removed.
- The component does not create command controls, synthetic `role="button"` elements, or custom `tabindex` state.
- `<ng-content>` remains transparent to interaction semantics. Caller-owned anchors stay anchors and caller-owned buttons stay native buttons.
- Existing Relay surface, typography, responsive spacing, light/dark behaviour, and per-user token ownership are unchanged.

## Accessibility and input methods

The viewer itself adds no keyboard interaction. Projected controls therefore keep their native Tab/Enter/Space/touch/context-menu behaviour according to their own element semantics. No focus trap, roving focus, key listener, `preventDefault()`, or imperative focus transfer is introduced by this stage.

The dedicated accessibility stage (#6151) remains responsible for document landmark naming, heading/landmark structure, RTL and high-zoom review. This issue intentionally does not pre-empt those semantic decisions.

## Failure, privacy, and security

The component has no network, authentication, persistence, analytics, clipboard, download, or mutation side effects. Projected content remains owned by the caller, so the viewer does not inspect, log, sanitize, rewrite, enable, or disable caller data or controls.

There is therefore no new failure state or private-data retention introduced by this change.

## Verification

The focused Angular suite now locks the interaction boundary by asserting that:

1. the viewer creates no button, synthetic button role, or custom tabindex;
2. projected fragment links retain their original `href` and native link semantics;
3. projected native buttons retain their native button semantics;
4. existing Relay token and responsive-layout contracts continue to render unchanged.

GitHub Actions remains the canonical clean-environment verification gate for the full frontend and repository checks.

## Rollout and rollback

No API, schema, route, persisted state, or user-data migration is required. The change is safe for mixed client versions. Rollback is a normal code revert; no data cleanup or server coordination is necessary.
