# Create Group regression and design-preview completion

Issue: #6085

Target: `frontend/src/app/components/create-group`

Status: complete once the focused regression suite and repository verification pass.

## Scope

This is the final regression/design-sync pass for the Create Group Spartan conversion. The runtime surface from #6082, Relay token/responsive work from #6083, and accessibility/focus pass from #6084 are preserved without introducing new product behaviour.

## Regression contract

`create-group.completion.spec.ts` locks the remaining high-value behaviour around the converted surface:

- group names are trimmed before `ChatService.createGroup()` receives them
- selected member IDs are forwarded unchanged and successful creation navigates to `/`
- already-selected users are excluded from partner-search results
- matching search results remain bounded to 20 entries
- discovery failures fail closed by clearing stale results and always clear the searching state
- runtime styling stays on Relay semantic surface, text, primary, and on-fill tokens
- direction-sensitive spacing remains expressed with logical inline properties
- the component does not regress to hardcoded hexadecimal product colours
- the Create action stays full-width on the mobile baseline and becomes content-width on wider layouts

The pre-existing Angular suite continues to cover member add/remove behaviour, duplicate prevention, the 49-member cap, stale-search protection, duplicate-submit prevention, form semantics, async state, focus recovery, translated labels, error association, and disabled/enabled submit state.

## Claude Design / design-preview synchronization

`frontend/design-preview/components/component-system.html` already contains the Create Group representation required by the final conversion pass. This ticket makes that representation an executable contract rather than duplicating it:

- **light/mobile**: `create-group-preview light`, labelled `Create group light mobile preview`
- **dark/wide**: `create-group-preview dark wide`, labelled `Create group dark wide preview`
- mobile primary action is full-width
- wide primary action is content-width and aligned to the logical inline end
- both states use system/semantic colours rather than fixed product palette values

The completion test reads the checked-in design preview and fails if those light/dark or responsive states disappear. This keeps the repository representation synchronized with the Claude Design `spartan.component-system` mapping without creating a parallel preview surface.

## DESIGN.md alignment

The completed surface retains the repository design constraints:

- Spartan Helm owns inputs and buttons.
- Relay semantic variables own surfaces, text, primary accent, warning, danger, success, borders, and on-fill contrast.
- Light and dark themes are first-class.
- Mobile remains the baseline, with the wider action treatment starting at 40rem.
- RTL-sensitive placement uses logical inline properties.
- Reduced-motion handling remains in the component stylesheet.
- 44px minimum action targets and the accessibility/focus contracts from #6084 are unchanged.

No API, routing contract, persistence, schema, authorization, analytics, or backend behaviour changes are introduced.

## Verification

The relevant verification gate is:

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

GitHub Actions remains the canonical clean-environment validation for the pull request.

## Rollout and rollback

This is test/documentation-only and can ship with any backend version. Rollback is a normal revert of the #6085 commit; no data repair, migration, or feature flag is required.
