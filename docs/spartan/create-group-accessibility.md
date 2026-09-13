# Create Group accessibility completion

Issue: #6084

Target: `frontend/src/app/components/create-group`

Prerequisites: #5462, #6081, #6082 and #6083 are complete. This pass keeps the existing Spartan controls and Relay token styling intact and closes the remaining keyboard, semantic, RTL and dynamic-focus gaps.

## Accessibility contract

### Form and field semantics

- The form is labelled by the visible Create Group heading.
- Group-name and member-search fields retain native `<label for>` relationships.
- Both free-text fields use `dir="auto"` so mixed-script names and queries render according to their own content without changing page direction.
- The member-search field exposes `aria-busy` while discovery is pending and references the result collection only while that collection exists.
- When the 49-invitee cap is reached, the disabled search field remains associated with the translated maximum-members explanation.

### Search results

Search results are an inline semantic `<ul>`/`<li>` collection. Each result remains a native Spartan button, preserving normal Tab/Shift+Tab focus order and Enter/Space activation without inventing a custom combobox keyboard model.

The visible identity remains part of the button's accessible name. A visually hidden translated `group.addBtn` prefix makes the action explicit while avatars, initials and the plus glyph remain decorative. The result list is labelled by the visible Add Members label.

### Selected members

The selected-member collection remains a semantic list labelled by its visible heading. The selected count is a polite, atomic live region so add/remove changes are announced without introducing an assertive interruption.

Remove actions keep the existing translated `group.removeMemberAria` label containing the member identity.

### Deterministic focus recovery

Dynamic collection mutations must not strand keyboard focus on DOM nodes that are about to disappear.

- Adding a search result moves focus back to member search before the activated result is removed.
- Adding the 49th invitee moves focus to Group Name instead, because member search becomes disabled at the cap.
- Removing a selected member moves focus to the next remove action when available, otherwise the previous remove action, otherwise member search.
- Programmatic calls to `removeMember()` without a DOM event keep their existing behavior and do not attempt synthetic focus movement.

Focus is moved before collection mutation so the browser never needs to recover focus from a detached control. Angular's `@for (...; track member.id)` keeps adjacent member controls stable across the update.

### Async and completion feedback

- Search retains non-visual `aria-busy` state while the decorative spinner is hidden from assistive technology.
- Group creation retains native disabled/busy semantics and its translated pending label.
- Creation failures remain assertive `role="alert"` content and are additionally referenced by the submit action after failure.
- Success remains a polite status and can likewise describe the submit action before navigation completes.

### RTL, reduced motion and zoom

The runtime styling from #6083 already uses logical inline properties for positioned icons and action spacing and contains no physical left/right layout dependency in this surface. The existing reduced-motion query disables spinner animation and control transitions.

This change intentionally does not retheme or resize the component. The only stylesheet adjustment resets list defaults introduced by changing search results from a generic container to semantic list markup, preserving the existing rendered layout. Therefore this ticket does not create a new visual contract or Claude Design preview state; the final regression/design-preview synchronization remains tracked by #6085.

At high zoom the surface remains document-scrollable, controls stay in DOM order, search results keep keyboard-scrollable overflow, and dynamic member actions preserve focus rather than disappearing from the active focus position.

## Regression coverage

`create-group.component.spec.ts` now explicitly covers:

- form labelling and visible member-search label association
- `dir="auto"` on free-text fields
- semantic/labelled search result list and selected-member list
- explicit translated Add action text without overriding visible identity
- search-to-selected focus recovery
- 49th-member focus recovery to a still-enabled control
- adjacent remove-action focus recovery
- polite selected-member count announcements
- member-limit disabled reason association
- create-failure alert association with the submit action
- existing stale-search protection, duplicate-create protection, member cap and creation behavior

## Verification

Canonical repository verification for this branch is GitHub Actions. The relevant local commands are:

```bash
cd frontend
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run test -- --watch=false
npm run build
cd ..
npm run check:design-sync
```

The implementation introduces no API, persistence, migration, authorization or analytics changes.

## Rollout and rollback

This is a client-only additive accessibility change. It can deploy with any backend version and has no persisted-state transition. Rollback is a normal revert of the #6084 commits. Reverting restores the previous focus/markup behavior without requiring data repair or a feature flag.
