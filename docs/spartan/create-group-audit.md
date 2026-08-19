# Create group Spartan / Relay audit

Issue: #6081

Target: `frontend/src/app/components/create-group`

Prerequisite: #5462 is complete.

## Purpose

This document is the ownership and migration map for `CreateGroupComponent`. It records every interactive control, state, side effect, route contract, and bespoke styling decision before follow-up Spartan conversion work changes the surface.

The component already uses Spartan Helm Button and Input. The main migration work is therefore not replacing those controls. It is consolidating form composition, member search and selection semantics, async feedback, avatars, status messaging, and the current hardcoded dark-only SCSS into the Relay token system.

## Current surface

`CreateGroupComponent` is a standalone Angular component that creates a group chat from a group name plus one or more selected members. It owns:

- group name entry
- live partner search
- a capped search-result list
- member add and remove actions
- a maximum of 49 selected members
- create-request pending, error, and success states
- navigation to `/` after successful creation

There are no overlays, popovers, dialogs, or menus in the current implementation.

## Control and state inventory

| Current UI / state             | Current implementation                                                                         | Spartan / Relay owner                                                                               | Migration decision                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group name field               | Native text input with `hlmInput`, `ngModel`, translated label and placeholder                 | Spartan Helm Input plus Field/Label composition, Relay form layout                                  | Retain `hlmInput`. Move label, description, validation, spacing, and status composition to the approved form recipe.                                                              |
| Member search field            | Native text input with `hlmInput`, live `ngModelChange`, search icon, disabled at member limit | Spartan Helm Input inside an approved autocomplete/combobox or search composition where appropriate | Retain Input ownership. The implementation ticket should confirm whether inline autocomplete or combobox best matches the non-overlay result behaviour before changing mechanics. |
| Search icon                    | Inline SVG positioned inside the input                                                         | Relay icon presentation using the approved icon stack                                               | Replace hand-authored generic SVG with the project icon stack when the visual conversion occurs. Keep it decorative when the input has an accessible name.                        |
| Search busy indicator          | Hand-authored CSS spinner                                                                      | Spartan feedback primitive or Relay async indicator                                                 | Replace the bespoke spinner with the approved Spinner/feedback composition and expose a non-visual busy state.                                                                    |
| Search result list             | Scrollable `<div>` containing one button per result                                            | Relay list/item composition with Spartan Button or approved autocomplete option semantics           | Preserve inline results and selection behaviour. Do not introduce an overlay unless product design explicitly changes the interaction.                                            |
| Search result row              | `<button hlmBtn>` containing avatar, identity, first native language, and plus indicator       | Spartan Helm Button / Item composition, Relay data layout                                           | Retain native button semantics. Prefer an Item-style composition if it preserves full-row activation and focus behaviour.                                                         |
| Result avatar                  | Native image or initial fallback inside custom circular wrapper                                | Spartan Avatar or approved Relay avatar wrapper                                                     | Migrate to the shared avatar primitive if available. Preserve decorative image semantics when the adjacent visible name provides identity.                                        |
| Result plus indicator          | Text `+` inside a custom bordered circle                                                       | Relay icon/presentation                                                                             | Treat as decorative because the row itself is the action. Prefer the shared icon stack or a semantic visual treatment.                                                            |
| Maximum-members message        | Conditional translated paragraph                                                               | Relay status/help text                                                                              | Preserve. Associate it with the search control and make the disabled reason perceivable.                                                                                          |
| Selected members heading/count | Heading plus signal-derived count                                                              | Relay typography/status composition                                                                 | Preserve `selectedCount()` as the source of truth.                                                                                                                                |
| Empty selected-members state   | Conditional text block with dashed border                                                      | Relay Empty composition                                                                             | Prefer the approved empty-state primitive if its scale fits this local sub-section. Do not over-promote it into a page-level empty state.                                         |
| Selected members list          | Semantic `<ul>` and `<li>` rows                                                                | Relay list/item composition                                                                         | Retain semantic list structure.                                                                                                                                                   |
| Selected member avatar         | Native image or initial fallback                                                               | Spartan Avatar or Relay avatar wrapper                                                              | Use the same avatar ownership as search results.                                                                                                                                  |
| Remove member action           | `<button hlmBtn>` with translated accessible name and inline X SVG                             | Spartan Helm Button plus project icon stack                                                         | Retain button semantics and localized accessible naming. Use an approved icon and destructive/quiet variant rather than one-off CSS.                                              |
| Error message                  | Conditional paragraph using `error()`                                                          | Spartan Alert or Relay inline validation/status composition                                         | Preserve the feature error state. Move presentation to semantic status tokens and make announcement behaviour deliberate.                                                         |
| Success message                | Conditional translated paragraph using `success()`                                             | Relay success status / Alert composition                                                            | Preserve while the success state remains observable before navigation. Avoid relying on colour alone.                                                                             |
| Create group action            | `<button hlmBtn>`, disabled until valid, label changes during creation                         | Spartan Helm Button plus Relay async-action recipe                                                  | Retain Spartan Button. Use an approved primary variant, proper busy semantics, and tokenized styling.                                                                             |
| Create busy indicator          | Hand-authored CSS spinner inside button                                                        | Spartan Spinner or Relay async-action composition                                                   | Replace bespoke spinner while retaining label change and disabled state.                                                                                                          |
| Search state                   | `isSearching()` signal                                                                         | Feature state                                                                                       | Preserve outside visual primitives.                                                                                                                                               |
| Create state                   | `isCreating()` signal                                                                          | Feature state                                                                                       | Preserve outside visual primitives.                                                                                                                                               |
| Search results                 | `searchResults()` signal                                                                       | Feature state                                                                                       | Preserve. Visual components receive state but do not own partner discovery.                                                                                                       |
| Member selection               | `selectedMembers()` plus computed IDs/count/limit                                              | Feature state                                                                                       | Preserve signal ownership and invariants.                                                                                                                                         |
| Error/success                  | `error()` and `success()` signals                                                              | Feature state                                                                                       | Preserve. Status primitives render them but do not own request outcomes.                                                                                                          |

## Existing Spartan ownership

The component already imports and uses:

- `HlmInput` from `@spartan-ng/helm/input`
- `HlmButton` from `@spartan-ng/helm/button`

These are the correct ownership layer for the current text fields and actions. The follow-up work must not introduce another local input or button abstraction.

The migration should instead normalise the surrounding composition:

- Field and Label for form structure and accessible relationships
- Avatar for repeated user identity presentation, if already installed and approved
- Spinner or another approved feedback primitive for pending states
- Empty for the local no-selection state when its composition fits
- Alert or an equivalent Relay status recipe for request failures and success feedback
- Item/list composition for repeated people rows where it preserves existing activation behaviour

Exact selectors and imports must be confirmed with the installed Spartan version before implementation.

## Behaviour contracts to preserve

### Group name

- The group name is required before submission.
- The template limits input length to 200 characters.
- `createGroup()` trims the name before sending it to `ChatService`.
- An empty or whitespace-only name prevents creation.

### Member search

`searchUsers()` trims the current query. An empty query immediately clears results without calling discovery.

For a non-empty query it calls `DiscoveryService.findPartners()` using the query as both `native_languages` and `target_language`, then performs local filtering against:

- display name
- native languages
- target languages
- user ID

Already-selected members are excluded and at most 20 results are retained.

A discovery failure currently clears the result list without exposing an error message. That is existing behaviour. A later implementation may improve feedback, but must do so deliberately with localized copy and tests rather than changing failure semantics accidentally during styling work.

### Member selection

- A result can be added only if fewer than 49 members are selected.
- Duplicate IDs are ignored.
- Adding a member removes that user from the current search results.
- Adding a member clears the search query.
- Removing a member deletes only that member from selection.
- Reaching 49 members disables search and displays the translated limit message.

These are feature invariants and must remain in `CreateGroupComponent` or a feature-level state helper, not move into Spartan primitives.

### Group creation

Creation is permitted only when the trimmed group name is non-empty and at least one member is selected.

The request contract is:

```text
ChatService.createGroup(trimmedGroupName, selectedMemberIds)
```

Before the request the component:

- sets `isCreating` true
- clears the previous error
- clears the previous success state

On success it sets `success` true and awaits navigation to `/`.

On failure it stores the thrown `Error.message`, or falls back to the translated `group.errorCreate` message for non-Error failures.

`isCreating` returns to false in `finally`.

Do not move request execution, error mapping, or router navigation into a visual primitive.

## Navigation and analytics

The only route side effect is successful creation navigating to `/`.

That route is an existing contract and should remain unchanged during the primitive migration unless a separate navigation/product ticket changes it.

There are no analytics calls in the current component. Do not add analytics implicitly as part of Spartan conversion.

## Accessibility audit

### Group name field

The current group name input has a real `<label for="groupNameInput">` relationship. Preserve this when adopting Spartan Field/Label composition.

The field currently has no inline validation message. The disabled Create button communicates form invalidity visually but does not explain the missing requirement. A follow-up may add concise localized help or validation while preserving the current submission guards.

### Member search field

The search field currently has no associated visible `<label>` of its own and uses the hardcoded accessible value `text input`. That violates the repository's zero hard-coded user-facing string rule and does not describe purpose.

The conversion must provide a localized accessible name tied to the `group.addMembers` or search intent. If result semantics become autocomplete/listbox based, the relationship between input, result collection, active option, expanded state, and keyboard operation must be supplied by the approved Spartan primitive rather than hand-authored ARIA.

### Search result rows

Each result is already a native button, which gives keyboard activation and focus semantics. Preserve that baseline.

The current accessible name is only `user.display_name || user.id`. If visible language metadata remains useful context, decide whether it belongs in the accessible name or description. The decorative plus indicator and avatar should not duplicate spoken content.

### Member-limit state

When the 49-member maximum is reached the input becomes disabled and a visible message appears. Ensure the reason is programmatically related to the control so users do not encounter an unexplained disabled field.

### Remove member action

The current remove button already uses the translated `group.removeMemberAria` key with the member name. Preserve that contract. The X icon should be decorative.

### Pending states

The search and create spinners are currently visual only. The migrated surface should expose meaningful busy status:

- search should indicate that results are being refreshed without generating excessive live-region chatter
- Create should expose `aria-busy` or the approved equivalent and retain a localized pending label

### Error and success status

The error and success paragraphs are visually differentiated primarily by colour. The converted status components must not rely on colour alone and should use appropriate announcement semantics for request completion.

### Focus behaviour

Adding or removing a member re-renders result/selection collections. Preserve stable focus where practical. Removing a selected member must not strand keyboard focus after its button disappears. Search-result updates must not unexpectedly move focus.

## RTL and internationalisation

The TypeScript uses `I18nService` for the fallback create error and the template uses `TranslatePipe` for nearly all product copy. Preserve this ownership.

Known gap:

- the member search input has hardcoded `[attr.aria-label]="'text input'"`

That must become a translation key during implementation.

The SCSS already uses logical inline properties for the search icon, spinner, plus indicator, and remove button margins. Preserve that direction-safe behaviour.

Do not introduce physical `left`/`right` spacing during conversion. Validate Arabic, Hebrew, and Persian direction as well as long translated labels, member names, and language names.

## Theme and token contract

The current SCSS is the largest visual migration risk. It hardcodes a dark-only palette throughout the component, including:

- `#121212` host background
- white and grey text values
- dark grey input/list surfaces and borders
- blue focus/add accents
- amber limit text
- red remove/error styling
- green success/create styling
- a bespoke green gradient

These values bypass Relay semantic roles and per-user primary accent behaviour.

The implementation ticket should remove product-colour ownership from this component and map roles to Relay semantic tokens for:

- page and elevated surfaces
- primary and secondary text
- subtle borders
- field focus
- primary action
- warning/limit status
- danger/remove/error status
- success status
- disabled state

Light and dark themes are both first-class. The current `:host` dark background must not survive as a global requirement.

The bespoke green gradient on the Create button should be replaced by the approved primary action variant unless `DESIGN.md` explicitly defines a semantic gradient role for this action.

## Responsive contract

The current container is capped at 480px and uses a single-column mobile form. The conversion should preserve mobile-first readability while deliberately validating wider layouts rather than merely stretching controls.

Verify at minimum:

- 375px mobile width
- 768px tablet width
- 1440px desktop width
- 200 percent browser zoom

Long names, language labels, and translated copy must wrap or truncate predictably without hiding action controls. The 49-member selected list can become tall, so preserve document scrolling and avoid nested scrolling unless a deliberate design requires it.

## Migration risks

1. **Dark-only visual ownership.** The hardcoded SCSS conflicts directly with light/dark parity, semantic Relay tokens, and per-user primary accent behaviour.
2. **Search semantics drift.** Converting the inline result list into an overlay or guessed combobox could change interaction and accessibility contracts unnecessarily.
3. **Hardcoded accessible copy.** The search input's `text input` label violates the translation rule and provides weak purpose information.
4. **Duplicate component ownership.** Inputs and buttons already belong to Spartan Helm. Replacing them with new project-local wrappers would create parallel primitives.
5. **Async feedback regression.** Visual-only spinners must be improved without making live announcements noisy on every keystroke.
6. **Member-limit regression.** Migration must preserve the exact maximum of 49 and the selected-member duplicate guard.
7. **Focus loss.** Add/remove operations mutate the rendered collections and can remove the currently focused control.
8. **Error-contract changes.** Search failures currently clear results, while create failures expose a message. Styling work must not silently conflate these paths.
9. **Route drift.** Successful creation currently awaits navigation to `/` and this must not change incidentally.
10. **Raw SVG drift.** Generic search/remove icons should converge on the approved icon stack rather than remain bespoke visual primitives.
11. **Form-state ownership.** Spartan/Relay components must not own partner discovery, member arrays, request execution, or router side effects.

## Required follow-up implementation shape

```text
CreateGroupComponent
  |- Relay form composition
  |    |- Field + Label + Spartan Input for group name
  |    |- approved search/autocomplete composition
  |    |- Relay/Spartan Item + Avatar result rows
  |    |- semantic member-limit/status messaging
  |    |- selected-member list
  |    |- Spartan Button remove actions
  |    |- Spartan Button create action + approved Spinner
  |    `- Alert/status composition for create outcome
  |
  `- feature logic
       |- DiscoveryService partner search
       |- selectedMembers signal state
       |- 49-member invariant
       |- ChatService.createGroup
       |- error/success state
       `- Router navigation
```

## Existing regression coverage

`create-group.component.spec.ts` currently covers:

- component creation and initial state
- adding, de-duplicating, and removing members
- the 49-member limit
- computed selected member IDs
- rejection of missing group name or members
- successful group creation
- create failure handling
- clearing results for an empty query
- display-name filtering
- `canAddMore()` behaviour
- Create button disabled/enabled state

Because this ticket changes documentation only, no runtime behaviour or test expectation changes are required in this PR.

## Regression coverage required by conversion

The implementation ticket should preserve existing tests and add focused coverage for:

- translated, purpose-specific accessible naming of the member search field
- keyboard interaction and semantic relationship between search field and dynamic results
- visible and programmatic search busy state
- member-limit message association with the disabled search control
- focus recovery after adding/removing a member
- remove action accessible name containing the member identity
- create pending state and prevention of duplicate submissions
- accessible create error/success status announcements
- light and dark theme token usage
- per-user primary accent compatibility
- RTL ordering and logical spacing
- 200 percent zoom and long translated copy
- absence of hardcoded product palette values after migration

## Verification for the implementation ticket

Run the repository's actual frontend gate after runtime conversion:

```bash
cd frontend
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run build
npm run test -- --watch=false
cd ..
npm run check:design-sync
```

If the conversion adds or changes Spartan components, also run the repository's Spartan healthcheck required by the scoped frontend instructions.

## Claude Design / design-preview contract

This audit records current runtime intent only. It does not itself change the visual contract, so no design-preview snapshot change is required in this documentation-only PR.

The conversion ticket must reconcile any material visual change through the documented Claude Design two-way workflow. Runtime Angular behaviour, Relay tokens, Spartan interaction contracts, and automated tests remain authoritative for shipped behaviour.

## Audit outcome

`CreateGroupComponent` does not need a new button or input primitive. Its existing `hlmBtn` and `hlmInput` ownership should be retained.

The recommended migration is to compose those controls with approved form, identity, item, empty, status, and feedback primitives, while moving the dark-only custom palette and one-off styling into Relay semantic roles. Partner search, member selection, the 49-member invariant, group creation, error mapping, and navigation remain feature responsibilities.
